# SeedStats 做种统计 + 本地对比清理插件 (MoviePilot V2, Vue 全页)

作者 liuziyi16,插件目录在 `plugins.v2/seedstats/`。开发/联调参考与说明见 DESIGN.md。

## 结构
```
plugins.v2/seedstats/
├─ __init__.py        插件后端(Python)
├─ seedstats.png     卡片图标
├─ src/               Vue 源码(联邦组件 AppPage,双 Tab:做种统计 / 本地清理)
├─ package.json       前端依赖(仅 vue/vite/@originjs federation,无重 UI 库)
├─ vite.config.js     build 到 dist/,name=SeedStats,exposes ./AppPage
├─ index.html         本地 dev 预览入口(与 MP 无关)
├─ dist/              已构建产物(remoteEntry.js + assets),随仓提交
└─ .gitignore         忽略 node_modules + package-lock
```

## 重新构建前端(改动 src/ 后)
```bash
npm install        # 首次
npm run build      # 产出 dist/;dist 需随仓提交,MP 依 get_render_mode 读 dist/assets
```

## 后端改动不必重构建,重启 MoviePilot 插件即可。
仅当修改了 Vue 组件(main/AppPage/provider)时才需要 `npm run build` 并提交 dist。

## 与 MoviePilot 部署的关系(你侧)
1. 把 `plugins.v2/seedstats/` 整个目录放进 MoviePilot 插件私有库(仓库根对应 MP "插件仓库"目录结构 `plugins.v2/<插件名>/`)。
2. MoviePilot 商店中点安装 → 启用:
   - 在「插件配置」原生表单里填 cron(种子统计默认 `0 */12 * * *`,本地扫描默认 `20 3 * * *`)、站点后缀/域名、磁盘路径映射、排除路径。
   - 启用后主界面侧栏出现「做种统计」全页(联邦 Vue)。
3. 说明:本环境不含真实 MoviePilot/qBittorrent/Transmission 服务,
   已用桩假客户端跑通种子统计、本地对比、安全删除与 cron 全链路。真实联调请在你的 NAS 上做。
