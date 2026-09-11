import os
import threading
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from apscheduler.triggers.cron import CronTrigger
from fastapi import Body
from fastapi.responses import JSONResponse

from app.helper.downloader import DownloaderHelper
from app.log import logger
from app.plugins import _PluginBase
from app.schemas import NotificationType
from app.utils.string import StringUtils

# 全局扫描互斥锁(单扫描进行中)
lock = threading.Lock()

# 种子统计定时任务名
SCAN_JOB = "SeedStats_scan"

# 本地扫描定时任务名(可选)
LOCAL_JOB = "SeedStats_local_scan"

# 默认 cron 表达式(5 段,宿主 local 时区)
# 种子统计默认每 12 小时(0 时/12 时整点)
DEFAULT_SEED_CRON = "0 */12 * * *"
# 本地对比扫描默认每天 03:20
DEFAULT_LOCAL_CRON = "20 3 * * *"

# 插件配置默认值(供 get_form 返回新装默认配置)
DEFAULT_CONFIG = {
    "enabled": False,
    "local_scan": False,
    "notify": False,
    "seed_cron": DEFAULT_SEED_CRON,
    "local_cron": DEFAULT_LOCAL_CRON,
    "downloaders": [],
    "site_suffixes": "",
    "site_domains": "",
    "path_map": "",
    "exclude_paths": "",
}


class SeedStats(_PluginBase):
    """做种统计与本地对比插件(V2, Vue 渲染)。"""

    # 插件元信息
    plugin_name = "做种统计"
    plugin_desc = "统计下载器做种情况,并按站点/官组汇总;对比本地目录,定位可安全删除的冗余文件。"
    plugin_icon = "seedstats.png"
    plugin_version = "1.2.9"
    plugin_author = "liuziyi16"
    author_url = "https://github.com/liuziyi16"
    plugin_config_prefix = "seedstats_"
    plugin_order = 60  # 自定义排序(建议偏后)
    auth_level = 1

    # 数据键
    DATA_STATS = "stats"          # 种子统计结果(缓存,供前端读)
    DATA_FILES = "files"          # 各下载器 hash 已取文件列表缓存
    DATA_LOCAL = "local"          # 本地对比扫描结果(缓存)

    def __init__(self):
        """初始化:注册插件数据操作与方法链。基类 __init__ 已设置 self.plugindata
        (PluginDataOper)、self.chain 等。此处仅做本插件私有属性的初始化。"""
        super().__init__()
        self._enabled: bool = False          # 模块级开关,不落盘(get_state 由库决定)
        self._downloaders: List[str] = []   # 启用下载器主机名列表
        self._exclude_paths: List[str] = []  # 本地排除路径
        self._path_map: Dict[str, str] = {}  # 远程->本地的磁盘路径映射
        self._site_suffixes: Dict[str, Dict[str, str]] = {}  # 站点名->多组后缀
        self._site_domains: Dict[str, set] = {}   # 站点名->域名集合(含用户补充)
        self._local_scan: bool = False       # 本地扫描是否加入定时
        self._seed_cron: str = DEFAULT_SEED_CRON   # 种子统计 cron(5 段)
        self._local_cron: str = DEFAULT_LOCAL_CRON  # 本地扫描 cron(5 段)
        self._notify: bool = False           # 扫描完成是否推送
        self._scanning: bool = False         # 是否正在扫描

    # ---------- 必须实现的抽象方法 ----------

    def init_plugin(self, config: Optional[dict] = None) -> None:
        """插件配置加载入口。在启用、修改配置、页面初始化时由系统调用。"""
        if config:
            self._enabled = config.get("enabled") or False
            self._downloaders = config.get("downloaders") or []
            self._exclude_paths = self._parse_list(config.get("exclude_paths"))
            self._path_map = self._parse_map(config.get("path_map"))
            self._site_suffixes = self._parse_suffixes(config.get("site_suffixes"))
            self._site_domains = self._parse_domains(config.get("site_domains"))
            self._local_scan = config.get("local_scan") or False
            self._notify = config.get("notify") or False
            # cron 表达式:空值/非法则回退默认
            self._seed_cron = self._valid_cron(config.get("seed_cron")
                                               or DEFAULT_SEED_CRON)
            self._local_cron = self._valid_cron(config.get("local_cron")
                                                or DEFAULT_LOCAL_CRON)

        # 只有处于"需定时执行"状态才启动调度
        self._reset_running_state()

    def _reset_running_state(self) -> None:
        """依当前 enabled 与 cron 配置启停后台定时任务。"""
        if not self._enabled:
            self._stop_scheduler()
            return
        if not self._downloaders:
            return
        # 若需要定时则启动;这里由系统 job 触发即可,本插件所有运行均在用
        # 自定义服务中实现,因此不在此额外启动 apscheduler。
        self._scanning = False if not self._enabled else self._scanning

    def _stop_scheduler(self) -> None:
        """清理后台调度线程(适配官方 stop 调用)。"""
        self._scanning = False

    def stop_service(self) -> None:
        """插件停止/卸载入口:复位运行中标记。"""
        self._scanning = False

    def get_state(self) -> bool:
        """插件是否启用。系统据此决定是否注入到 Vue 侧栏/调度。"""
        return self._enabled

    # ---------- Vue 渲染与侧栏入口声明 ----------

    @classmethod
    def get_render_mode(cls) -> Tuple[str, str]:
        """声明使用 Vue 联邦组件渲染。dist 路径随版本变化, 避免浏览器缓存旧界面。"""
        return "vue", f"dist/v{cls.plugin_version}/assets"

    def get_sidebar_nav(self) -> List[Dict[str, Any]]:
        """将本插件主页面注册到主界面侧栏(全页入口)。"""
        if not self._enabled:
            return []
        return [
            {
                "nav_key": "main",
                "title": "做种统计",
                "icon": "mdi-chart-donut",
                "section": "system",
                "permission": "manage",
                "order": 60,
            }
        ]

    def get_api(self) -> List[Dict[str, Any]]:
        """注册 Vue 界面调用的后端 API(路由前缀 /plugin/SeedStats)。"""
        return [
            {"path": "/data", "endpoint": self.api_data, "methods": ["GET"],
             "auth": "bear", "summary": "获取种子统计视图数据(缓存)"},
            {"path": "/local", "endpoint": self.api_local, "methods": ["GET"],
             "auth": "bear", "summary": "获取本地对比视图数据(?scan=1 强制重扫)"},
            {"path": "/scan", "endpoint": self.api_scan, "methods": ["POST"],
             "auth": "bear", "summary": "后台触发完整扫描(body: {local: bool})"},
            {"path": "/delete", "endpoint": self.api_delete, "methods": ["POST"],
             "auth": "bear", "summary": "永久删除本地文件+清理空目录(body:{paths})"},
            {"path": "/clean_empty", "endpoint": self.api_clean_empty,
             "methods": ["POST"], "auth": "bear",
             "summary": "清理本地对比目录树中的空目录"},
            {"path": "/services", "endpoint": self.api_services, "methods": ["GET"],
             "auth": "bear", "summary": "获取可用下载器与路径信息"},
            {"path": "/validate_path_map", "endpoint": self.api_validate_path_map,
             "methods": ["POST"], "auth": "bear",
             "summary": "逐行校验 path_map 远程/本地前缀是否存在(body:{raw?})"},
            {"path": "/sites", "endpoint": self.api_sites, "methods": ["GET"],
             "auth": "bear",
             "summary": "列出 MP 系统已激活站点 + 用户已配域名(供 site_domains 编辑器)"},
            {"path": "/site_domains_suggest", "endpoint": self.api_site_domains_suggest,
             "methods": ["GET"], "auth": "bear",
             "summary": "某站点的域名建议:MP 收录域名 + 当前下载器 tracker 域名"},
        ]

    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        """插件原生配置表单(VUE 模式下由主应用 Form 渲染在插件设置页)。
        Vue 全页(侧栏)仅做数据展示与操作。"""
        return [
            {
                "component": "VSwitch",
                "content": [
                    {
                        "component": "VRow",
                        "content": [
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {"label": "启用插件"},
                                        "model": "enabled",
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {
                                            "label": "启用每日本地对比",
                                            "hint": "按上方本地周期定时对比磁盘,生成可删候选清单(不会自动删)"},
                                        "model": "local_scan",
                                    }
                                ],
                            },
                            {
                                "component": "VCol",
                                "props": {"cols": 12, "md": 4},
                                "content": [
                                    {
                                        "component": "VSwitch",
                                        "props": {
                                            "label": "扫描完成通知",
                                            "hint": "统计/对比完成后的推送提醒"},
                                        "model": "notify",
                                    }
                                ],
                            },
                        ],
                    }
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VTextField",
                                "props": {
                                    "label": "种子统计 cron",
                                    "placeholder": "0 */12 * * *",
                                    "hint": "5 段 cron(宿主时区)。种子统计周期,默认每 12 小时整点。留空回退默认。",
                                },
                                "model": "seed_cron",
                            }
                        ],
                    },
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VTextField",
                                "props": {
                                    "label": "本地对比 cron",
                                    "placeholder": "20 3 * * *",
                                    "hint": "5 段 cron(宿主时区)。仅当启用「每日本地对比」时生效,默认每天 03:20。",
                                },
                                "model": "local_cron",
                            }
                        ],
                    },
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VSelect",
                                "props": {
                                    "multiple": True,
                                    "chips": True,
                                    "label": "参与统计的下载器",
                                    "hint": "留空=统计所有已启用下载器;仅对列出的实例做种统计与本地对比。",
                                },
                                "model": "downloaders",
                                "api": "/plugin/core/services?type=downloader",
                            }
                        ],
                    }
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VTextarea",
                                "props": {
                                    "label": "站点官方后缀(判定官组)",
                                    "rows": 3,
                                    "hint": "每行/每|一项,格式: 站点名:后缀1,后缀2,后缀3(不区分大小写)\n例: ChdBits:ChdW,CHD",
                                },
                                "model": "site_suffixes",
                            }
                        ],
                    }
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VTextarea",
                                "props": {
                                    "label": "站点域名补充",
                                    "rows": 3,
                                    "hint": "每行/每|一项,格式: 站点名:域名1,域名2\n系统已收录站点会按 tracker 域名自动识别;此项用于补充别名域名。仅做种子统计可留空。",
                                },
                                "model": "site_domains",
                            }
                        ],
                    }
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VTextarea",
                                "props": {
                                    "label": "磁盘路径映射(远程→本地)",
                                    "rows": 3,
                                    "hint": "每行/每|一项,格式: 远程前缀=本地根目录\n当 MoviePilot/下载器的下载路径与此插件所在节点看到的本地路径不一致、且你启动了本地对比时必填。例: /downloads=/volume1/downloads\n只做种子统计(不启用本地对比)可留空。",
                                },
                                "model": "path_map",
                            }
                        ],
                    }
                ],
            },
            {
                "component": "VRow",
                "content": [
                    {
                        "component": "VCol",
                        "props": {"cols": 12, "md": 12},
                        "content": [
                            {
                                "component": "VTextarea",
                                "props": {
                                    "label": "本地对比排除路径",
                                    "rows": 2,
                                    "hint": "每行/每|一项,命中的绝对前缀(目录或文件)将被跳过(如同时做其它用途的下载目录)。",
                                },
                                "model": "exclude_paths",
                            }
                        ],
                    }
                ],
            },
        ], dict(DEFAULT_CONFIG)

    def get_page(self) -> List[dict]:
        """Vue 模式:详情弹窗/全页内容由联邦组件渲染。"""
        return []

    # ---------- 调度声明 ----------

    def get_service(self) -> List[Dict[str, Any]]:
        """注册后台定时任务(种子统计 + 可选本地扫描),仅在插件启用时注册。
        trigger 使用 CronTrigger.from_crontab(std),受宿主 local 时区驱动;
        func 为直接在调度器线程内执行的扫描方法(get_state 关闭时不注册)。"""
        if not self._enabled:
            return []
        services = [{
            "id": SCAN_JOB,
            "name": "做种统计-种子扫描",
            "trigger": CronTrigger.from_crontab(self._seed_cron),
            "func": self._scan_seed,
        }]
        # 本地对比可选任务:仅当用户开启 local_scan 且表达式有效时注册
        if self._local_scan:
            services.append({
                "id": LOCAL_JOB,
                "name": "做种统计-本地扫描",
                "trigger": CronTrigger.from_crontab(self._local_cron),
                "func": self._scan_local,
            })
        return services

    # ---------- 配置解析工具 ----------

    @staticmethod
    def _valid_cron(expr: Any) -> str:
        """校验并返回合法 5 段 cron;空/非法回退默认值 DEFAULT_SEED_CRON。"""
        if not expr:
            return DEFAULT_SEED_CRON
        text = str(expr).strip()
        try:
            CronTrigger.from_crontab(text)
            return text
        except Exception:
            return DEFAULT_SEED_CRON

    @staticmethod
    def _parse_list(raw: Any) -> List[str]:
        """通用:将文本(支持换行 或 | 分隔)或列表拆分为清理后的项列表。"""
        if not raw:
            return []
        if isinstance(raw, list):
            return [str(x).strip() for x in raw if str(x).strip()]
        items = []
        for line in str(raw).splitlines():
            for frag in line.split("|"):
                frag = frag.strip()
                if frag and frag not in items:
                    items.append(frag)
        return items

    @staticmethod
    def _parse_map(raw: Any) -> Dict[str, str]:
        """每行 '远程=本地' 或 '远程->本地' 生成 dict。"""
        out: Dict[str, str] = {}
        for line in SeedStats._parse_list(raw):
            for sep in ("=", "->", "=>"):
                if sep in line:
                    k, _, v = line.partition(sep)
                    out[k.strip()] = v.strip()
                    break
        return out

    @staticmethod
    def _parse_suffixes(raw: Any) -> Dict[str, Dict[str, str]]:
        """每行: 站点名:后缀1,后缀2  存成 {站点: {后缀: 站点名}} 便于O(1)匹配。

        分隔符支持中英文逗号/分号 (, ; ， ;) — 任选一种都可; 保留大小写不敏感, suffix 存大写。
        """
        result: Dict[str, Dict[str, str]] = {}
        sep_re = re.compile(r"[,;；，]")
        for line in SeedStats._parse_list(raw):
            if ":" in line:
                site, _, suffixes = line.partition(":")
                key = site.strip().lower()
                result[key] = {}
                for suf in sep_re.split(suffixes):
                    suf = suf.strip().upper()
                    if suf:
                        result[key][suf] = site.strip()
        return result

    @staticmethod
    def _parse_domains(raw: Any) -> Dict[str, set]:
        """每行: 站点名:域名1,域名2  存成 {站点: {域名...}}。

        分隔符支持中英文逗号/分号 (, ; ， ;) — 任选一种都可; 域名存小写便于大小写不敏感匹配。
        """
        result: Dict[str, set] = {}
        sep_re = re.compile(r"[,;；，]")
        for line in SeedStats._parse_list(raw):
            if ":" in line:
                site, _, domains = line.partition(":")
                acc: set = set()
                for d in sep_re.split(domains):
                    d = d.strip().lower()
                    if not d:
                        continue
                    acc.add(d)
                    try:
                        sld = StringUtils.get_url_sld(d if "//" in d else f"https://{d}")
                    except Exception:
                        sld = ""
                    if sld:
                        acc.add(str(sld).strip().lower())
                if acc:
                    result[site.strip()] = acc
        return result

    # ============ 下载器访问引擎(Step3) ============

    def get_active_services(self) -> Optional[Dict[str, Any]]:
        """返回所有已连接的活动下载器服务 {name: ServiceInfo}。
        仅保留未 inactive 之实例;异常/离线返回 None(调用方记录告警)。"""
        if not self._downloaders:
            return None
        try:
            services = DownloaderHelper().get_services(name_filters=self._downloaders)
            active = {}
            offline = []
            for name, info in (services or {}).items():
                try:
                    if info.instance.is_inactive():
                        offline.append(name)
                    else:
                        active[name] = info
                except Exception as e:
                    logger.error(f"下载器 {name} 连接检测失败:{e}")
                    offline.append(name)
            if not active and offline:
                logger.warning(f"下载器均未连接:{','.join(offline)}")
            elif offline:
                logger.warning(f"以下下载器离线,跳过:{','.join(offline)}")
            return active
        except Exception as e:
            logger.error(f"获取下载器服务异常:{e}")
            return None

    def get_indexer_site_map(self) -> Dict[str, str]:
        """构造 域名->站点名 查找表:优先用户 site_domains 补充项,其次系统已收录站点。
        返回 {域名.lower(): 站点名}。系统站点在访问失败时静默降级(报错不影响整体)。"""
        found = {}
        # 1) 用户自定义站点域名映射
        user_keys: set = set()
        for site_name, domains in self._site_domains.items():
            for d in domains:
                k = str(d).strip().lower()
                found[k] = site_name
                user_keys.add(k)
        # 2) 合并 MoviePilot 系统环境已激活的站点域名(通过 DB 直接读,无副作用)
        try:
            from app.db.site_oper import SiteOper
            oper = SiteOper()
            for row in oper.list_active():
                dom = getattr(row, "domain", None)
                name = getattr(row, "name", "") or ""
                if dom and name:
                    if dom.startswith("http"):
                        dom = StringUtils.get_url_sld(dom)
                    k = str(dom).strip().lower()
                    if k not in user_keys:
                        found.setdefault(k, name)
        except Exception as e:
            logger.debug(f"读取系统站点域名失败(将仅依赖用户配置):{e}")
        return found

    def _site_name_for_torrent(self, torrent_sld: str, domain_map: Dict[str, str]) -> str:
        """输入 tracker 主域(sld),返回站点名;无法识别返回 '未识别'。"""
        if not torrent_sld:
            return "未识别"
        key = torrent_sld.lower()
        if key in domain_map:
            return domain_map[key]
        best = ""
        best_len = -1
        for dom, name in domain_map.items():
            if not dom:
                continue
            if key == dom or key.endswith("." + dom) or dom.endswith("." + key):
                if len(dom) > best_len:
                    best, best_len = name, len(dom)
        if best:
            return best
        return "未识别"

    def _downloaders_name_type(self, info_map: Dict[str, Any]) -> None:
        """占位:后续可扩展。"""
        pass

    # ---------- 种子获取与归一化 ----------

    def _gather_torrents(self, services: Dict[str, Any],
                         domain_map: Dict[str, str]) -> List[dict]:
        """遍历活动下载器拉取种子并归一化为统一结构,失败逐项隔离。"""
        normalized: List[dict] = []
        for name, svc in (services or {}).items():
            client = svc.instance
            try:
                torrents, err = client.get_torrents()
            except Exception as e:
                err = True
            if err:
                logger.error(f"下载器 {name} 获取种子列表失败")
                continue
            d_type = getattr(getattr(svc, "config", None), "type", "") or ""
            for t in torrents or []:
                try:
                    item = self._normalize_torrent(t, d_type, name, domain_map)
                    if item:
                        normalized.append(item)
                except Exception as e:
                    logger.debug(f"归一化种子异常({name}):{e}")
        return normalized

    def _tracker_domains_qb(self, torrent: Any) -> List[str]:
        """qBittorrent:从 torrent.tracker / torrent.trackers 提取 tracker 主域集合。"""
        out = []
        raw = getattr(torrent, "tracker", "") or ""
        for part in str(raw).replace(";", " ").split():
            if part.startswith(("http://", "https://", "udp://")):
                sld = StringUtils.get_url_sld(part)
                if sld and sld not in out:
                    out.append(sld)
        return out

    def _normalize_torrent(self, t: Any, d_type: str, downloader: str,
                           domain_map: Dict[str, str]) -> Optional[dict]:
        """把各下载器种子对象归一化为统一 dict。qB 传 TorrentDictionary、
        TR 传 Torrent 对象;二者字段差异在此统一。"""
        if d_type.lower() == "qbittorrent":
            return self._normalize_qb(t, downloader, domain_map)
        # 默认按 TR/transmission 处理
        return self._normalize_tr(t, downloader, domain_map)

    def _torrent_state(self, raw: str, is_tr: bool = False) -> str:
        """归一化为可读中文状态分组。"""
        if is_tr:
            return self._tr_state_text(raw)
        state = str(raw or "").lower()
        mapping = {
            "downloading": "下载中", "forceddl": "下载中",
            "stalleddl": "下载中", "metadl": "下载中",
            "forcedmetadl": "下载中", "allocating": "下载中",
            "queueddl": "排队中",
            # 暂停: qB 4.6 前为 paused*, 4.6+ 改名 stopped*; 两套都要认
            "pauseddl": "暂停", "stoppeddl": "暂停",
            "pausedup": "暂停", "stoppedup": "暂停",
            "error": "错误", "missingfiles": "错误",
            "uploading": "做种中", "stalledup": "做种中",
            "forcedup": "做种中",
            # 校验中不是做种, 单列
            "checkingup": "检查中", "checkingdl": "检查中",
            "checkingresume": "检查中", "queuedforchecking": "检查中",
            "queuedup": "排队中", "queued": "排队中",
            "moving": "移动中", "unknown": "其他",
        }
        return mapping.get(state, "其他")

    def _tr_state_text(self, status: Any) -> str:
        """TR 状态归一化。

        transmission-rpc 的 Torrent.status 返回 Status 枚举, 值是**字符串**
        ('seeding'/'stopped'/'downloading'/'checking'/'check pending'/
         'download pending'/'seed pending')。老版本 RPC 或直接取 raw field
        时才是数字。两种都要认 —— 只按 int() 解析会让所有 TR 种子
        ValueError 落到 0 == "暂停", 做种数恒为 0。
        """
        # 注意: 不能写 str(status or "") —— status==0 (TR 老版"暂停") 会被吞成空串
        s = ("" if status is None else str(status)).strip().lower()
        str_map = {
            "seeding": "做种中",
            "stopped": "暂停",
            "downloading": "下载中",
            "checking": "检查中",
            "check pending": "检查中",
            "check_pending": "检查中",
            "download pending": "排队中",
            "download_pending": "排队中",
            "seed pending": "排队中",
            "seed_pending": "排队中",
        }
        if s in str_map:
            return str_map[s]
        # 回退: 老版数字协议
        try:
            st = int(s)
        except (TypeError, ValueError):
            return "其他"
        tr_map = {
            0: "暂停", 1: "检查中", 2: "检查中", 3: "排队中",
            4: "下载中", 5: "排队中", 6: "做种中",
        }
        return tr_map.get(st, "其他")

    def _normalize_qb(self, t: Any, downloader: str,
                      domain_map: Dict[str, str]) -> Optional[dict]:
        """qBittorrent TorrentDictionary -> 统一结构。
        字段使用按 torrentremover 已验证访问(official:见 _is_official 聚合)。"""
        try:
            name = (t.name or "").strip()
            if not name:
                return None
            state = self._torrent_state(getattr(t, "state", ""))
            size = int(getattr(t, "size", 0) or 0)
            is_complete = state == "做种中" or float(
                getattr(t, "progress", 0) or 0) >= 1
            # 站点归因(以 tracker 主域)
            domains = self._tracker_domains_qb(t)
            sites = {self._site_name_for_torrent(d, domain_map) for d in domains}
            known_sites = sorted(s for s in sites if s != "未识别")
            site_name = "、".join(known_sites) if known_sites else (
                domains[0] if domains else "未识别")
            return {
                "id": t.hash,
                "name": name,
                "downloader": downloader,
                "size": size,
                "state": state,
                "complete": bool(is_complete),
                "seeding": state == "做种中",
                "paused": state == "暂停",
                "official": False,          # 占位,官组在 _scan_seed 里按站点合并重判
                "site": site_name,
                "sites": (sites or {"未识别"}),
                "domains": domains,
                "cross_seed": len(domains),   # 去重后的域名/站点数(=辅种来源数)
                "ratio": getattr(t, "ratio", 0) or 0,
            }
        except Exception:
            return None

    def _normalize_tr(self, t: Any, downloader: str,
                      domain_map: Dict[str, str]) -> Optional[dict]:
        """Transmission Torrent 对象 -> 统一结构。trackers 通常带 sitename 字段,
        否则退化为按 announce 主域识别。"""
        try:
            name = (t.name or "").strip()
            if not name:
                return None
            state = self._tr_state_text(str(getattr(t, "status", "")))
            size = int(getattr(t, "total_size", 0) or 0)
            domains = []
            tr_sitenames = set()
            for track in (t.trackers or []):
                if isinstance(track, dict):
                    ann = track.get("announce") or ""
                    sn = track.get("sitename") or ""
                else:
                    ann = getattr(track, "announce", "") or ""
                    sn = getattr(track, "sitename", "") or ""
                if sn and sn not in tr_sitenames:
                    tr_sitenames.add(sn.strip())
                if ann.startswith(("http://", "https://", "udp://")):
                    sld = StringUtils.get_url_sld(ann)
                    if sld and sld not in domains:
                        domains.append(sld)
            # 优先 TR 自带 sitename;否则走域名映射
            if tr_sitenames:
                known_sites = sorted(tr_sitenames)
            else:
                sites = {self._site_name_for_torrent(d, domain_map) for d in domains}
                known_sites = sorted(s for s in sites if s != "未识别")
                if not known_sites and domains:
                    known_sites = domains[:1]
                if not known_sites:
                    known_sites = ["未识别"]
            return {
                "id": t.hashString or getattr(t, "hash", ""),
                "name": name,
                "downloader": downloader,
                "size": size,
                "state": state,
                "complete": bool(getattr(t, "left_until_done", 0) == 0),
                "seeding": state == "做种中",
                "paused": state == "暂停",
                "official": False,
                "site": "、".join(known_sites),
                "sites": set(known_sites),
                "domains": domains,
                "cross_seed": len(known_sites),
                "ratio": getattr(t, "ratio", 0) or 0,
            }
        except Exception:
            return None

    # ---------- 官组判定 ----------

    def _official_suffix_for(self, site_names: set) -> Optional[set]:
        """给出站点名集合(sites)命中的所有官组后缀。返回 {后缀(大写)} /
        None(无任何命中)。用于种子级命名比对待命中即算官组。"""
        matched = set()
        for site in (site_names or set()):
            cfg = self._site_suffixes.get(str(site).strip().lower())
            if cfg:
                matched.update(cfg.keys())
        return matched or None

    def _is_official(self, raw_name: str, site_names: set) -> bool:
        """判断指定种子的名称是否命中某已识别站点的官组后缀。"""
        suffixes = self._official_suffix_for(site_names)
        if not suffixes:
            return False
        upper = str(raw_name or "").upper()
        # 复合同后缀站点键可能含多种写法,逐一在名称中查找
        return any(suf in upper for suf in suffixes)

    def _append_official_flag(self, torrents: List[dict]) -> None:
        """给归一化后的种子统一贴上 official 标记:
        命中任一归属站点的官组后缀即为 True。就地修改字典。"""
        for item in torrents:
            try:
                item["official"] = self._is_official(
                    item.get("name", ""), item.get("sites") or set())
            except Exception:
                item["official"] = False

    # ================= 种子统计扫描(Step3 核心) =================

    def _scan_seed(self) -> None:
        """后台线程:拉取所有启用下载器种子,归一化+官组判定+聚合并落盘缓存。
        失败按下载器隔离,数据仍部分可用。成功才覆写旧缓存。"""
        if self._scanning:
            logger.info("另有扫描正在执行,本次种子统计跳过")
            return
        try:
            lock.acquire()
            self._scanning = True
            active = self.get_active_services()
            domain_map = self.get_indexer_site_map()
            raw = self._gather_torrents(active or {}, domain_map)
            self._append_official_flag(raw)
            summary = self._aggregate(raw)
            # tracker 原始主域只进日志/本地细节,不进大缓存(可选)。聚合见 _aggregate
            data = {
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "torrent_count": len(raw),
                "active_downloaders": list((active or {}).keys()),
                "sites": summary["sites"],
                "official_groups": summary["official_groups"],
                "states": summary["states"],
                "unidentified": summary["unidentified"],
                "overall": summary["overall"],
            }
            # sets 序列化:转 list
            data["official_groups"] = [
                {**g, "sites": list(g["sites"]) if "sites" in g else []}
                for g in data["official_groups"]
            ]
            self.save_data(self.DATA_STATS, data)
            logger.info(
                f"做种统计完成:{data['torrent_count']} 个种子,"
                f"{len(data['active_downloaders'])} 个下载器")
            if self._notify:
                self.post_message(
                    mtype=NotificationType.Plugin,
                    title=f"做种统计完成",
                    text=(
                        f"种子总数:{data['torrent_count']};"
                        f"覆盖站点:{len(data['sites'])} 个;"
                        f"下载器:{','.join(data['active_downloaders'])}"))
        except Exception as e:
            logger.error(f"做种统计扫描异常:{e}")
        finally:
            self._scanning = False
            try:
                lock.release()
            except Exception:
                pass

    def _aggregate(self, torrents: List[dict]) -> dict:
        """对归一化种子生成统计视图:按站点/州/官组聚合大小+做种数量。"""
        site_rows: Dict[str, dict] = {}
        state_rows: Dict[str, dict] = {}
        off_rows: Dict[str, dict] = {}     # 官组: 站点名 -> 累计
        unmatch_rows: Dict[str, dict] = {}  # 非官组: 站点名 -> 累计 (同站点没命中后缀的种子)
        unidentified: List[dict] = []
        totals = {"size": 0, "count": 0, "seeding": 0, "seeding_size": 0,
                  "paused": 0, "paused_size": 0, "ratio_sum": 0.0}
        for item in torrents:
            size = item.get("size", 0) or 0
            site = item.get("site") or "未识别"
            st = item.get("state", "其他")
            is_seed = bool(item.get("seeding"))
            # paused 字段由归一化层给出; 兼容旧缓存则回退按 state 判断
            is_paused = bool(item.get("paused")) or st == "暂停"
            totals["size"] += size
            totals["count"] += 1
            totals["ratio_sum"] += float(item.get("ratio", 0) or 0)
            if is_seed:
                totals["seeding"] += 1
                totals["seeding_size"] += size
            if is_paused:
                totals["paused"] += 1
                totals["paused_size"] += size
            # 站点
            rr = site_rows.setdefault(site, {
                "site": site, "count": 0, "size": 0,
                "seeding_count": 0, "seeding_size": 0,
                "paused_count": 0, "paused_size": 0, "official": 0})
            rr["count"] += 1
            rr["size"] += size
            if is_seed:
                rr["seeding_count"] += 1
                rr["seeding_size"] += size
            if is_paused:
                rr["paused_count"] += 1
                rr["paused_size"] += size
            # 官组 / 非官组 必须是对称的 if-else (旧代码 else 错挂在内层
            # if item.get("seeding") 上, 导致非官组桶只收到官组里没做种的那部分)
            if item.get("official"):
                rr["official"] += 1
                og = off_rows.setdefault(site, {
                    "site": site, "count": 0, "seeding_count": 0,
                    "paused_count": 0, "size": 0, "seeding_size": 0})
                og["count"] += 1
                og["size"] += size
                if is_seed:
                    og["seeding_count"] += 1
                    og["seeding_size"] += size
                if is_paused:
                    og["paused_count"] += 1
            else:
                # 非官组: 站点识别了但种子名没命中后缀
                ug = unmatch_rows.setdefault(site, {
                    "site": site, "count": 0, "seeding_count": 0,
                    "paused_count": 0, "size": 0, "seeding_size": 0})
                ug["count"] += 1
                ug["size"] += size
                if is_seed:
                    ug["seeding_count"] += 1
                    ug["seeding_size"] += size
                if is_paused:
                    ug["paused_count"] += 1
            # 状态
            sr = state_rows.setdefault(st, {"state": st, "count": 0, "size": 0})
            sr["count"] += 1
            sr["size"] += size
            # 未识别(无论是否有域名),仅记录便于排查
            if site == "未识别":
                unidentified.append({"name": item.get("name", ""),
                                     "downloader": item.get("downloader", "")})
        return {
            "sites": sorted(site_rows.values(), key=lambda x: -x["size"]),
            "states": sorted(state_rows.values(), key=lambda x: -x["count"]),
            "official_groups": sorted(off_rows.values(), key=lambda x: -x["size"]),
            "unmatched_groups": sorted(unmatch_rows.values(), key=lambda x: -x["size"]),
            "unidentified": unidentified[:200],  # 限制长度,防缓存过大
            "overall": {
                "size": totals["size"],
                "count": totals["count"],
                "seeding_count": totals["seeding"],
                "seeding_size": totals["seeding_size"],
                "paused_count": totals["paused"],
                "paused_size": totals["paused_size"],
                "avg_ratio": round(totals["ratio_sum"] / totals["count"], 3)
                if totals["count"] else 0,
            },
        }

    # ----- 本地磁盘映射与 covered 收集 -----

    # ================= 本地对比扫描(Step4) =================

    def _scan_local(self) -> None:
        """后台线程:以各启用下载器的『保存根目录』为锚点做差异扫描。
        种子内所有文件计入 covered(须经磁盘路径映射换算到本地绝对路径);
        os.walk 锚点后减去 covered,剩余未覆盖项即为可安全删除的冗余候选。
        结果落盘 DATA_LOCAL。

        v1.2.7 重要修正:
          原实现 anchors dict 的 key 是 _map_remote_to_local 映射后的"本地"
          路径, 在容器内看不到 (典型 NAS btrfs 同子卷 mountinfo 源端是块
          设备), _collect_covered 第 1015 行 os.path.isdir() 直接返回,
          锚点进不到 anchors -> roots=[] -> removables=[] -> 0 候选.
        改为: roots 与 covered 分离, roots 始终用 map 后的"容器视角"路径
          (即便容器看不到也让 _compare_local_trees 决定要不要 walk);
          covered 只在容器内可见时才收集, 避免 covered 集跟 walk 集
          空间不一致导致"全空集 -> 全文件都是候选"的反向极端。
        """
        if self._scanning:
            logger.info("另有扫描正在执行,本次本地扫描跳过")
            return
        try:
            lock.acquire()
            self._scanning = True
            warn: List[str] = []
            # 所有候选锚点(容器可见 + 不可见, 都会传给 _compare_local_trees)
            roots: List[str] = []
            roots_seen: set = set()
            # 仅"容器内可见"的 anchor -> 该根下已覆盖(种子占用)的本地绝对路径集
            anchors_visible: Dict[str, set] = {}
            try:
                active = self.get_active_services()
                for name, svc in (active or {}).items():
                    client = svc.instance
                    d_type = str(getattr(getattr(svc, "config", None),
                                         "type", "")).lower() or ""
                    try:
                        torrents, err = client.get_torrents()
                        if err:
                            warn.append(f"{name}:读取种子失败,跳过该下载器")
                            continue
                        for t in torrents or []:
                            self._collect_covered(
                                client, d_type, t, roots, roots_seen,
                                anchors_visible, warn)
                    except Exception as e:
                        warn.append(f"{name}:遍历种子异常:{e}")
            except Exception as e:
                warn.append(f"整体下载器访问异常:{e}")
            removables, tree, empty_dirs = self._compare_local_trees(
                roots, anchors_visible, exclude=self._exclude_paths)
            todo = [float(v.get("size", 0)) for v in removables]
            self.save_data(self.DATA_LOCAL, {
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "roots": roots,
                "removable_count": len(removables),
                "removable_size": sum(todo),
                "removable": removables,
                "tree": tree[:2000],
                "empty_dirs": empty_dirs,
                "warnings": warn,
            })
            logger.info(f"本地对比完成:候选 {len(removables)} 项,"
                        f"{int(sum(todo))} 字节(可删)")
        except Exception as e:
            logger.error(f"本地对比扫描异常:{e}")
        finally:
            self._scanning = False
            try:
                lock.release()
            except Exception:
                pass

    def _collect_covered(self, client: Any, d_type: str, t: Any,
                         roots: List[str], roots_seen: set,
                         anchors_visible: Dict[str, set],
                         warn: List[str]) -> None:
        """为单个种子取其磁盘根(remote 保存目录),换算为本地锚点。
        v1.2.7: roots 与 anchors_visible 分开管理:
          - roots: 始终记录每个种子的容器视角锚点(去重);即便容器看不见
            也会传给 _compare_local_trees, 由它决定 os.walk 能否跑通
          - anchors_visible: 仅当 anchor 容器内可见时收集 covered 文件;
            避免 covered 集跟 walk 集不在同一 inode 命名空间
        """
        try:
            # 种子保存根(remote 可见)
            if d_type == "qbittorrent":
                remote_root = getattr(t, "save_path", "") or ""
            else:
                remote_root = getattr(t, "download_dir", "") or ""
            if not remote_root:
                warn.append(f"{getattr(t,'name','?')}:无保存路径,跳过")
                return
            container_path, nas_path = self._resolve_local_path(remote_root)
            if not nas_path:
                warn.append(f"{getattr(t,'name','?')}:路径 {remote_root} "
                            f"未在 path_map 中命中, 跳过")
                return
            if self._in_exclude(nas_path):
                return
            # roots 用 nas_path (跨容器可标识的稳定路径, 也是 deployment
            # 检测的 key)
            if nas_path not in roots_seen:
                roots.append(nas_path)
                roots_seen.add(nas_path)
            # covered 必须跟 os.walk 同空间 -> 用 container_path (容器内可见)
            if container_path and os.path.isdir(container_path):
                covered = anchors_visible.setdefault(nas_path, set())
                for local_file in self._fetch_streams_local(client, d_type, t):
                    if local_file:
                        covered.add(local_file)
            # 容器内看不到 -> covered 收不到, deployment_warnings 会提示挂载
        except Exception as e:
            warn.append(f"收集种子覆盖文件出错:{e}")

    def _fetch_streams_local(self, client: Any, d_type: str,
                             t: Any) -> List[str]:
        """将种子各文件换算为『本地绝对路径』(与 os.walk 产物同空间)。
        remote 文件绝对路径一律经由 _map_remote_to_local 前缀换算到本地。"""
        out: List[str] = []
        if d_type == "qbittorrent":
            tid = t.hash
            content = getattr(t, "content_path", "") or ""
            if not content:
                return out
            # 单文件种子:content_path 即本体文件
            if os.path.isfile(self._map_remote_to_local(content) or content):
                try:
                    rem = self._map_remote_to_local(content)
                    if rem:
                        out.append(os.path.normpath(rem))
                except Exception:
                    pass
                return out
            try:
                flist = client.get_files(tid) or []
            except Exception:
                flist = []
            save = getattr(t, "save_path", "") or ""
            for f in flist:
                nm = getattr(f, "name", "") or ""
                if not nm:
                    continue
                # qB name 以 save_path 为基准拼合
                remote_abs = os.path.join(save, nm)
                loc = self._map_remote_to_local(remote_abs)
                if loc:
                    out.append(os.path.normpath(loc))
        else:
            tid = getattr(t, "hashString", "") or getattr(t, "hash", "")
            ddir = getattr(t, "download_dir", "") or ""
            if not tid or not ddir:
                return out
            try:
                flist = client.get_files(tid) or []
            except Exception:
                flist = []
            for f in flist:
                nm = getattr(f, "name", "") or ""
                if not nm:
                    continue
                remote_abs = os.path.join(ddir, nm)
                loc = self._map_remote_to_local(remote_abs)
                if loc:
                    out.append(os.path.normpath(loc))
        return out


    def _map_remote_to_local(self, remote: str) -> Optional[str]:
        """[v1.2.9 兼容保留] 返回容器内可见路径 (给 _fetch_streams_local 用)."""
        return self._resolve_local_path(remote)[0]

    def _resolve_local_path(self, remote: str) -> Tuple[Optional[str], Optional[str]]:
        """[v1.2.9] 把 remote (qB 容器视角) 换算成 (container_path, nas_path):
          - container_path: MP 容器内可见的本地绝对路径; 找不到则 None
            (用于 covered 收集 + os.walk, 必须同空间)
          - nas_path: NAS 真实路径 (path_map 直接结果), 容器内看不到但宿主存在
        换算链: qB 视角 -> path_map[lp] = NAS 路径 ->
          NAS 路径反查 MP 容器挂载表 -> 容器内挂载点
        """
        if not remote:
            return None, None
        norm = remote.replace("\\", "/").rstrip("/")
        best_len = -1
        best_nas = None
        for rp, lp in self._path_map.items():
            rkey = rp.replace("\\", "/").rstrip("/")
            if not rkey:
                continue
            if norm == rkey:
                nas = lp.replace("\\", "/").rstrip("/") or norm
                container = self._map_nas_to_container(nas)
                return container, nas
            if norm.startswith(rkey + "/") and len(rkey) > best_len:
                best_len = len(rkey)
                best_nas = lp.replace("\\", "/").rstrip("/")
        if best_nas:
            suffix = norm[best_len:]
            nas = (best_nas + suffix) or norm
            container = self._map_nas_to_container(nas)
            return container, nas
        return None, None

    def _map_nas_to_container(self, nas_path: str) -> Optional[str]:
        """[v1.2.9] 把 NAS 路径换算成 MP 容器内可见路径.

        算法: 读 /proc/self/mountinfo, 对每条 bind mount (source -> mount_point),
        如果 nas_path 等于 source 或以 source + "/" 开头, 替换为
        mount_point + 余下后缀.

        例: 宿主 /volume1/docker bind 到容器 /docker
          输入 /volume1/docker/12hermes/data -> /docker/12hermes/data
        """
        if not nas_path:
            return None
        norm = self._normalize_for_match(nas_path)
        if not norm:
            return None
        if not hasattr(self, "_mounts_cache"):
            mounts = self._read_mountinfo()
            # 按 source 长度降序, 优先匹配最长前缀 (子目录挂载优先于父目录)
            self._mounts_cache = sorted(
                [(self._normalize_for_match(src), mp)
                 for src, mp in mounts
                 if src and mp and src != "none" and not src.startswith("/dev/")],
                key=lambda x: -len(x[0]))
        for src_norm, mp in self._mounts_cache:
            if not src_norm:
                continue
            if norm == src_norm:
                return os.path.normpath(mp)
            if norm.startswith(src_norm + "/"):
                suf = norm[len(src_norm):]
                return os.path.normpath(mp.rstrip("/") + suf)
        return None

    def _local_path_usable(self, p: str) -> bool:
        """给定 path_map 配置的 local 路径, 判断容器内是否可直接访问。

        只检查路径前两段(top + sub)是否存在 —— 不递归, 避免对大目录做 stat;
        实际打开文件失败由 _compare_local_trees 兜底。
        """
        if not p or not p.startswith("/"):
            return False
        parts = [x for x in p.split("/") if x]
        if not parts:
            return False
        # 先试完整路径(用户配的就是 /a/b/c, 可能 a 存在但 /a 不直接可见)
        if os.path.exists(p):
            return True
        # 否则逐级向上找到第一个存在的祖先
        cur = "/"
        for part in parts:
            cur = os.path.join(cur, part)
            if os.path.exists(cur):
                return True
        return False

    def _is_host_path(self, p: str) -> bool:
        """给定一个容器外路径, 反查宿主挂载表判断它是否为挂载源端。"""
        if not p:
            return False
        n = self._normalize_for_match(p)
        if not n:
            return False
        if not hasattr(self, "_host_sources_cache"):
            mounts = self._read_mountinfo()
            cache: List[str] = []
            for src, _mp in mounts:
                nn = self._normalize_for_match(src)
                if nn and nn not in cache:
                    cache.append(nn)
            self._host_sources_cache = cache
        for src_norm in self._host_sources_cache:
            if n == src_norm or n.startswith(src_norm + "/"):
                return True
        return False

    def _in_exclude(self, abspath: str) -> bool:
        """若本地路径命中任一配置的排除前缀,返回 True。"""
        if not abspath:
            return False
        n = os.path.normpath(abspath).replace("\\", "/")
        for ex in self._exclude_paths:
            en = os.path.normpath(ex).replace("\\", "/")
            if n == en or n.startswith(en.rstrip("/") + "/"):
                return True
        return False

    def _compare_local_trees(self, roots: List[str],
                             cover_map: Dict[str, set],
                             exclude: Optional[List[str]] = None) -> tuple:
        """在每个本地根下 os.walk;凡文件不在该根 covered 绝对路径集合的,
        标记为可删候选(记录绝对路径+大小+相对根)。同时列出空目录。
        返回 (removables, tree, empty_dirs)。exclude 用于跳过的本地前缀。

        v1.2.7: roots 里可能有容器内 os.path.isdir() == False 的项
          (NAS 宿主路径, 容器 namespace 看不到), 原版直接 continue -> 漏掉
          这些锚点下的冗余文件. 改为:
          - 先尝试用原 root 走 os.walk
          - 失败(OSError)再尝试用 remote 原值 (回退到 path_map 前)
          - 还失败则跳过, 但累计到 warnings 由前端展示
        """
        exclude = exclude or []
        removables: List[dict] = []
        tree: List[dict] = []
        empty_dirs: List[str] = []
        warnings_extra: List[str] = []
        # 容器内可 walk 的 root -> 直接走
        # 容器内不可见但可能存在的 root -> 试 remote 原值
        # 注: cover_map 仅含容器可见 root 的 covered 集, 对 fallback 走的
        # remote 原值没有 covered, 这些 root 会全列候选 (即"看到的全部
        # 不是种子的文件") —— 这是保守做法, 不会误删种子内文件
        def _safe_walk_base(root: str) -> Optional[str]:
            """[v1.2.9] root 是 nas_path; 查容器挂载表反查容器内挂载点.
            没有直接 None (deployment_warnings 会提示挂载问题)"""
            container = self._map_nas_to_container(root)
            if container and os.path.isdir(container):
                return os.path.normpath(container)
            return None

        for root in roots:
            covered = cover_map.get(root) or set()
            base = _safe_walk_base(root)
            if not base:
                warnings_extra.append(f"{root}:容器内不可见且无 remote 回退, 跳过")
                continue
            for dirpath, dirnames, filenames in os.walk(base):
                # 递归排除
                dirnames[:] = [
                    d for d in dirnames
                    if not self._in_exclude(os.path.join(dirpath, d))]
                rel = os.path.relpath(dirpath, base)
                rel_pre = ("/" if rel != "." else "") + rel
                for fn in filenames:
                    full = os.path.normpath(os.path.join(dirpath, fn))
                    if full in covered:
                        continue
                    try:
                        sz = os.path.getsize(full)
                    except OSError:
                        sz = 0
                    removables.append({
                        "path": full,
                        "rel": (rel_pre + "/" + fn) if rel != "." else fn,
                        "size": sz,
                        "type": "file",
                    })
                    tree.append({"path": full, "rel": rel if rel != "." else "",
                                 "name": fn, "size": sz, "kind": "file"})
        # 自动发现全空目录:扫描所有根下空目录(无文件也无子目录遗留)
        for root in roots:
            base = _safe_walk_base(root)
            if not base:
                continue
            for dirpath, dirnames, filenames in os.walk(base, topdown=False):
                if not dirnames and not filenames:
                    empty_dirs.append(dirpath)
        if warnings_extra:
            logger.info("本地对比回退信息: " + "; ".join(warnings_extra[:5]))
        # 合并 candidate 类型辅助
        removable_sorted = sorted(removables, key=lambda x: -x.get("size", 0))
        return removable_sorted, tree, empty_dirs

    # ================= 安全删除 API(Step5) =================

    def _delete_candidates(self, rel_paths: List[str]) -> Dict[str, Any]:
        """按删除请求执行:仅在 rel 命中最新缓存 DATA_LOCAL 可删清单时才真正删除,
        删除后向上清理空父目录。返回 {deleted, failed, rejected}。"""
        cache = self.get_data(self.DATA_LOCAL) or {}
        removable = cache.get("removable") or []
        ok_rel = {str(x.get("rel", "")) for x in removable}
        deleted: List[str] = []
        failed: List[dict] = []
        rejected: List[str] = []
        for relp in rel_paths or []:
            # 只允许删除缓存中明确列为可删项
            if relp not in ok_rel:
                rejected.append(relp)
                continue
            full = self._rel_to_abs(relp, removable)
            if not full or not os.path.lexists(full):
                rejected.append(relp)
                continue
            try:
                if os.path.isdir(full) and not os.path.islink(full):
                    os.rmdir(full)          # 只会成功删空目录(可删项为文件)
                else:
                    os.remove(full)
                deleted.append(relp)
                self._prune_empty_parents(os.path.dirname(full))
            except Exception as e:
                failed.append({"rel": relp, "err": str(e)})
        # 重扫刷新(后台),保证前端与缓存一致
        if deleted and not self._scanning:
            threading.Thread(target=self._scan_local, daemon=True).start()
        return {"deleted": deleted, "failed": failed, "rejected": rejected}

    def _prune_empty_parents(self, d: Optional[str]) -> None:
        """从目录 d 一路向上,凡到空目录即删除,直到非空或到达系统根。"""
        cur = d
        guard = 0
        while cur and guard < 32:
            try:
                if os.path.isdir(cur) and not os.path.islink(cur) \
                        and not os.listdir(cur):
                    os.rmdir(cur)
                    cur = os.path.dirname(cur)
                else:
                    break
            except OSError:
                break
            guard += 1

    def _rel_to_abs(self, relp: str, removable: List[dict]) -> Optional[str]:
        """依据最近一次本地扫描缓存的可删清单,返回项的真实绝对路径。"""
        for x in removable:
            if str(x.get("rel", "")) == relp:
                return x.get("path")
        return None

    # ================= API Endpoints(Step2) =================
    # 全部返回 JSONResponse;路由注册见 get_api()

    def api_data(self) -> JSONResponse:
        """获取最新种子统计缓存。前端先读缓存,必要时再触发 /scan。"""
        data = self.get_data(self.DATA_STATS) or {}
        if not data:
            return JSONResponse({"ok": True, "empty": True, "data": {}})
        return JSONResponse({"ok": True, "data": data})

    def api_local(self) -> JSONResponse:
        """获取本地对比扫描缓存。触发新扫描请调用 /scan(local)。"""
        data = self.get_data(self.DATA_LOCAL) or {}
        return JSONResponse({"ok": True, "data": data})

    def api_scan(self, body: dict = Body(default={})) -> JSONResponse:
        """后台触发扫描。body: {local: bool|None, seed: bool|None, refresh: bool}。
        省略时默认种子统计;local=true 则执行本地对比。"""
        if self._scanning:
            return JSONResponse({"ok": False, "err": "已有扫描正在进行,请稍后"},
                                status_code=409)
        do_local = bool(body.get("local"))
        do_seed = bool(body.get("seed")) or bool(body.get("refresh"))
        if not do_seed:
            # 缺省/均未指定 → 种子统计;local 显式优先本地
            do_seed = not do_local
        if do_local:
            logger.info("触发后台本地对比扫描")
            threading.Thread(target=self._scan_local, daemon=True).start()
            return JSONResponse({"ok": True, "started": "local"})
        logger.info("触发后台种子统计扫描")
        threading.Thread(target=self._scan_seed, daemon=True).start()
        return JSONResponse({"ok": True, "started": "seed"})

    def api_delete(self, body: dict = Body(...)) -> JSONResponse:
        """安全删除接口:{paths: [rel,...]}。仅删除本地对比标记的冗余项。"""
        paths = body.get("paths") or []
        if not isinstance(paths, list) or not paths:
            return JSONResponse({"ok": False, "err": "paths 不能为空"},
                                status_code=400)
        result = self._delete_candidates([str(p) for p in paths])
        return JSONResponse({"ok": True, "result": result})

    def api_clean_empty(self, body: dict = Body(default={})) -> JSONResponse:
        """清理本地对比目录树中已确认的空目录:仅删除缓存 empty_dirs 列表命中项。"""
        cache = self.get_data(self.DATA_LOCAL) or {}
        empty = cache.get("empty_dirs") or []
        ok = set(str(x) for x in empty)
        removed: List[str] = []
        failed: List[dict] = []
        for d in empty:
            if d not in ok:      # 理论不会发生,双保险
                continue
            try:
                if os.path.isdir(d) and not os.path.islink(d) \
                        and not os.listdir(d):
                    os.rmdir(d)
                    removed.append(str(d))
            except Exception as e:
                failed.append({"dir": str(d), "err": str(e)})
        # 空目录移除后其父目录可能也空
        if removed:
            threading.Thread(target=self._scan_local, daemon=True).start()
        return JSONResponse({"ok": True, "removed": removed, "failed": failed})

    def api_services(self) -> JSONResponse:
        """返回可供配置引用的下载器服务清单(名称列表)与磁盘映射占位说明。"""
        helper = DownloaderHelper()
        try:
            services = helper.get_configs().values()
        except Exception as e:
            logger.warning(f"读取下载器失败:{e}")
            services = []
        names = [getattr(s, "name", "") for s in services
                 if getattr(s, "name", "")]
        names = [n for n in names if n]
        return JSONResponse({"ok": True, "services": names,
                             "hint": "下载器名需与「下载器」模块中命名一致"})

    # ===== 站点域名编辑器辅助端点 (用于 site_domains VTextarea 升级版) =====

    def api_sites(self) -> JSONResponse:
        """列出 MP 系统已激活站点(用于 site_domains 编辑器 VSelect 数据源)。

        返回 {ok, sites: [{id, name, domain, domains}], user_domains: {site: [domain]}}
        """
        sites: List[dict] = []
        try:
            from app.db.site_oper import SiteOper
            oper = SiteOper()
            for row in oper.list_active():
                name = getattr(row, "name", "") or ""
                dom = getattr(row, "domain", None) or ""
                cleaned = StringUtils.get_url_sld(dom) if dom else ""
                sites.append({
                    "id": getattr(row, "id", None),
                    "name": name,
                    "domain": cleaned,
                    "domains": [cleaned] if cleaned else [],
                })
        except Exception as e:
            logger.warning(f"读取系统站点失败:{e}")
            return JSONResponse({"ok": False, "err": str(e), "sites": []})

        user_domains = {sn: sorted(ds) for sn, ds in (self._site_domains or {}).items()}
        return JSONResponse({"ok": True, "sites": sites, "user_domains": user_domains})

    def api_site_domains_suggest(self, site_id: Optional[int] = None,
                                 site_name: Optional[str] = None) -> JSONResponse:
        """某站点的域名建议: MP 收录 + 当前下载器 tracker 实际出现的域名。

        二选一参数 (site_name 优先匹配 MP 系统名)。
        返回 {ok, site_name, mp_domains, tracker_domains}
        """
        target_name = ""
        mp_domains: List[str] = []
        try:
            from app.db.site_oper import SiteOper
            oper = SiteOper()
            for row in oper.list_active():
                rid = getattr(row, "id", None)
                rname = getattr(row, "name", "") or ""
                if (site_id is not None and rid == site_id) or (site_name and rname == site_name):
                    target_name = rname
                    dom = getattr(row, "domain", None) or ""
                    if dom:
                        cleaned = StringUtils.get_url_sld(dom)
                        if cleaned:
                            mp_domains.append(cleaned)
                    break
        except Exception as e:
            logger.warning(f"读站点列表失败:{e}")

        tracker_domains: set = set()
        if target_name:
            try:
                helper = DownloaderHelper()
                services = helper.get_services() or {}
                domain_map = self.get_indexer_site_map()
                for _name, svc in services.items():
                    client = getattr(svc, "instance", None)
                    if not client:
                        continue
                    try:
                        torrents, err = client.get_torrents()
                    except Exception:
                        continue
                    if err or not torrents:
                        continue
                    d_type = getattr(getattr(svc, "config", None), "type", "") or ""
                    for t in torrents or []:
                        try:
                            sld = self._tracker_sld(t, d_type)
                            if not sld:
                                continue
                            if self._site_name_for_torrent(sld.lower(), domain_map) == target_name:
                                tracker_domains.add(sld.lower())
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"读下载器 tracker 失败:{e}")

        return JSONResponse({
            "ok": True,
            "site_name": target_name,
            "mp_domains": mp_domains,
            "tracker_domains": sorted(tracker_domains),
        })

    @staticmethod
    def _tracker_sld(torrent: Any, d_type: str) -> str:
        """从单个 torrent 提取 tracker 主域(sld)。qB/TR 通用。"""
        tracker = ""
        try:
            d = (d_type or "").lower()
            if "qbittorrent" in d or "qb" == d.strip():
                tracker = (getattr(torrent, "tracker", None) or
                           getattr(torrent, "tracker_url", None) or "")
            elif "transmission" in d or "tr" == d.strip():
                trackers = (getattr(torrent, "trackers", None) or
                            getattr(torrent, "tracker_urls", None) or [])
                if trackers and isinstance(trackers, (list, tuple)):
                    for tk in trackers:
                        if isinstance(tk, dict):
                            tracker = tk.get("announce") or tk.get("url") or ""
                        elif isinstance(tk, str):
                            tracker = tk
                        if tracker:
                            break
            else:
                tracker = (getattr(torrent, "tracker", None) or "")
        except Exception:
            return ""
        if not tracker:
            return ""
        return StringUtils.get_url_sld(tracker)

    # ---------- path_map 校验 ----------

    # 校验结果状态码(便于前端配色/图标):
    #   ok         - 远程 + 本地均存在
    #   bad_remote - 远程前缀不存在(可能写错路径/下载器未挂载)
    #   bad_local  - 本地前缀不存在(可能 NAS 路径写错)
    #   bad_both   - 两端均不存在
    #   bad_format - 分隔符缺失或两边都空
    PATH_OK = "ok"                  # 远程+本地均容器内可见
    PATH_OK_HOST = "ok_host"         # 本地是宿主路径, mountinfo 源端可见 (bind-mount)
    PATH_OK_GUESS = "ok_guess"       # 本地是宿主路径, 无法直接验证, 视为通过
    PATH_BAD_REMOTE = "bad_remote"
    PATH_BAD_LOCAL = "bad_local"
    PATH_BAD_BOTH = "bad_both"
    PATH_BAD_FORMAT = "bad_format"

    @staticmethod
    def _read_mountinfo() -> List[Tuple[str, str]]:
        """读 /proc/self/mountinfo, 返回 [(宿主源路径, 容器内挂载点), ...]。

        MP 跑在容器里,校验 path_map 本地前缀时,直接 os.path.exists 看不到
        NAS 宿主路径。但容器的 bind mount 一定在 /proc/self/mountinfo 里
        登记, 源端是宿主绝对路径 —— 用宿主侧路径去匹配, 就能反推出
        "NAS 上这条路径确实存在 / 挂到了容器某个点"。
        """
        out: List[Tuple[str, str]] = []
        try:
            with open("/proc/self/mountinfo", "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.split()
                    if len(parts) < 10 or "-" not in parts:
                        continue
                    sep = parts.index("-")
                    if len(parts) < sep + 3:
                        continue
                    mount_point = parts[4]
                    source = parts[sep + 2]
                    if source and mount_point and source != "none":
                        out.append((source, mount_point))
        except Exception:
            pass
        return out

    @staticmethod
    def _normalize_for_match(p: str) -> str:
        if not p:
            return ""
        return os.path.normpath(p).replace("\\", "/").rstrip("/")

    @staticmethod
    def _split_path_line(line: str) -> Tuple[str, str]:
        """与 _parse_map 同步:支持 =, ->, => 三种分隔符,两边各自 strip。
        找不到分隔符返回 ("", "");两侧任一为空也算拆分失败。"""
        s = (line or "").strip()
        if not s:
            return ("", "")
        for sep in ("->", "=>", "="):   # 多字符优先,避免 "=" 抢分
            if sep in s:
                k, _, v = s.partition(sep)
                k = k.strip()
                v = v.strip()
                if not k or not v:
                    return ("", "")
                return (k, v)
        return ("", "")

    def api_validate_path_map(self, body: dict = Body(default={})) -> JSONResponse:
        """逐行校验 path_map 配置。

        优先读 body.raw(用户在配置页尚未保存的最新文本);为空则用已加载的
        self._path_map(配置项已保存并初始化插件)。无论来源,逐行 split 检查
        远程/本地前缀是否存在。

        返回结构(便于前端表格按行展示):
          { ok: bool, summary: {total, ok, bad_format, bad_remote, bad_local, bad_both},
            lines: [ {line_no, raw, remote, local, status, msg}, ... ] }
        """
        # 1) 决定校验源:body.raw 优先(用户在编辑框里点了"校验"),
        #    否则用已加载的 self._path_map(用于自检/回显)
        raw = ""
        if isinstance(body, dict):
            raw = str(body.get("raw") or "")
        use_loaded = not raw.strip()
        if use_loaded:
            raw = "\n".join(f"{rp}={lp}" for rp, lp in (self._path_map or {}).items())

        results: List[Dict[str, Any]] = []
        counts = {"total": 0, self.PATH_OK: 0, self.PATH_OK_HOST: 0,
                  self.PATH_OK_GUESS: 0,
                  self.PATH_BAD_FORMAT: 0, self.PATH_BAD_REMOTE: 0,
                  self.PATH_BAD_LOCAL: 0, self.PATH_BAD_BOTH: 0}

        # 与 _parse_list 一致:支持换行 / '|' 两种分隔
        items: List[str] = []
        for line in raw.splitlines():
            for frag in line.split("|"):
                frag = frag.strip()
                if frag:
                    items.append(frag)

        # 启发式校验: 格式 + 远程端可达是硬要求; 本地端走三档
        #   - 容器内可见          -> 本地 OK (最强)
        #   - mountinfo 源端可见   -> 宿主路径 OK (bind-mount 部署)
        #   - 都不在              -> 视为"宿主路径(无法直接验证)", 不报红,
        #                              但文案提醒"扫描侧实际以该路径打开, 失败时报"
        #                              (典型: NAS btrfs 同子卷, mountinfo 源端
        #                               是块设备不是宿主路径)
        mounts = self._read_mountinfo()
        host_sources_norm: List[str] = []
        for src, _mp in mounts:
            n = self._normalize_for_match(src)
            if n and n not in host_sources_norm:
                host_sources_norm.append(n)

        def host_side_exists(local_path: str) -> bool:
            n = self._normalize_for_match(local_path)
            if not n:
                return False
            for src_norm in host_sources_norm:
                if n == src_norm or n.startswith(src_norm + "/"):
                    return True
            return False

        for idx, line in enumerate(items, start=1):
            counts["total"] += 1
            remote, local = self._split_path_line(line)
            if not remote or not local:
                results.append({
                    "line_no": idx, "raw": line, "remote": remote, "local": local,
                    "status": self.PATH_BAD_FORMAT,
                    "msg": "分隔符(= / -> / =>)缺失或一侧为空",
                })
                counts[self.PATH_BAD_FORMAT] += 1
                continue
            remote_in_container = os.path.exists(remote)
            local_in_container = os.path.exists(local)
            local_on_host = (host_side_exists(local)
                             if not local_in_container else False)
            if local_in_container:
                local_status = "container"
                local_msg_extra = ""
            elif local_on_host:
                local_status = "host_mount"
                local_msg_extra = "(宿主路径, bind-mount 到容器某点)"
            else:
                local_status = "host_guess"
                local_msg_extra = "(宿主路径, 容器/mountinfo 不可直接验证; 扫描侧会以该路径打开, 失败时再报)"

            if remote_in_container and local_status == "container":
                status = self.PATH_OK
                msg = "远程与本地前缀均存在(容器内)"
            elif remote_in_container and local_status == "host_mount":
                status = self.PATH_OK_HOST
                msg = "远程容器内可见, 本地为宿主路径" + local_msg_extra
            elif remote_in_container and local_status == "host_guess":
                status = self.PATH_OK_GUESS
                msg = "远程容器内可见, 本地" + local_msg_extra
            elif not remote_in_container and local_status == "container":
                status = self.PATH_BAD_REMOTE
                msg = "远程前缀不存在(检查下载器挂载或拼写); 本地容器内可见"
            elif not remote_in_container and local_status == "host_mount":
                status = self.PATH_BAD_REMOTE
                msg = "远程前缀不存在(检查下载器挂载或拼写); 本地宿主路径" + local_msg_extra
            elif not remote_in_container and local_status == "host_guess":
                status = self.PATH_BAD_REMOTE
                msg = "远程前缀不存在(检查下载器挂载或拼写); 本地" + local_msg_extra
            else:
                status = self.PATH_BAD_BOTH
                msg = "远程与本地前缀均不存在(检查下载器挂载和 NAS 路径)"
            results.append({
                "line_no": idx, "raw": line, "remote": remote, "local": local,
                "status": status, "msg": msg,
                "remote_in_container": remote_in_container,
                "local_status": local_status,
                "local_on_host": local_on_host,
            })
            counts[status] += 1

        return JSONResponse({
            "ok": counts[self.PATH_BAD_FORMAT] == 0
                  and counts[self.PATH_BAD_REMOTE] == 0
                  and counts[self.PATH_BAD_LOCAL] == 0
                  and counts[self.PATH_BAD_BOTH] == 0,  # host_*, guess 均视为通过
            "source": "body.raw" if not use_loaded else "loaded",
            "summary": counts,
            "lines": results,
        })

