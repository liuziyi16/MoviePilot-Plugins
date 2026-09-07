import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};

const {createTextVNode:_createTextVNode,resolveComponent:_resolveComponent,withCtx:_withCtx,createVNode:_createVNode,createElementVNode:_createElementVNode,toDisplayString:_toDisplayString,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock} = await importShared('vue');


const _hoisted_1 = {
  class: "plugin-config",
  style: {"padding":"16px"}
};
const _hoisted_2 = { class: "d-flex justify-end ga-2 ss-sticky-bar" };
const _hoisted_3 = { class: "d-flex align-center mb-1" };
const _hoisted_4 = { class: "text-body-2" };
const _hoisted_5 = { class: "text-body-2 text-medium-emphasis" };
const _hoisted_6 = {
  class: "text-right",
  style: {"width":"72px","white-space":"nowrap"}
};
const _hoisted_7 = {
  key: 1,
  class: "text-body-2 text-medium-emphasis pa-3"
};
const _hoisted_8 = { class: "d-flex align-center mb-1" };
const _hoisted_9 = { class: "text-body-2" };
const _hoisted_10 = { class: "text-body-2 text-medium-emphasis" };
const _hoisted_11 = {
  class: "text-right",
  style: {"width":"72px","white-space":"nowrap"}
};
const _hoisted_12 = {
  key: 1,
  class: "text-body-2 text-medium-emphasis pa-3"
};

const {ref,reactive,onMounted} = await importShared('vue');


// MP 设置弹框传入: initial-config(当前配置) + api(主应用api客户端)

const _sfc_main = {
  __name: 'Config',
  props: {
  initialConfig: { type: Object, default: () => ({}) },
  api: { type: Object, default: () => ({}) },
},
  emits: ['close', 'switch', 'save'],
  setup(__props, { emit: __emit }) {

const props = __props;

const emit = __emit;

const DEFAULTS = {
  enabled: false,
  local_scan: false,
  notify: false,
  seed_cron: '',
  local_cron: '',
  downloaders: [],
  site_suffixes: '',
  site_domains: '',
  path_map: '',
  exclude_paths: '',
};

const config = reactive({ ...DEFAULTS });
const saving = ref(false);
const error = ref(null);
const snackbar = reactive({ show: false, text: '', color: 'success' });
const downloaderOptions = ref([]);
const loadingDownloaders = ref(false);
// 站点规则(结构化编辑, 保存时序列化回字符串): [{site, values: []}] 一站点一行
const suffixRules = ref([]);
const domainRules = ref([]);
const siteOptions = ref([]);
const loadingSites = ref(false);
const ruleDlg = reactive({ show: false, type: 'suffix', site: '', values: [''], editingIndex: null });

// '站点名:值1,值2' 多行文本 -> [{site, values[]}]（按站点合并, 兼容中文逗号与竖线分隔）
function parseRules(str) {
  const out = [];
  String(str || '').split(/\n+/).forEach(line => {
    const s = line.trim();
    if (!s || !s.includes(':')) return
    const idx = s.indexOf(':');
    const site = s.slice(0, idx).trim();
    if (!site) return
    const vals = s.slice(idx + 1).split(/[,，|]+/).map(v => v.trim()).filter(Boolean);
    if (!vals.length) return
    const exist = out.find(r => r.site.toLowerCase() === site.toLowerCase());
    if (exist) exist.values.push(...vals);
    else out.push({ site, values: vals });
  });
  return out
}

// [{site, values[]}] -> '站点名:值1;值2' 多行文本（分号拼接; 后端兼容逗号/分号分隔）
function serializeRules(rules) {
  return rules
    .map(r => {
      const site = String(r.site || '').trim();
      const vals = (r.values || []).map(v => String(v || '').trim()).filter(Boolean);
      return site && vals.length ? `${site}:${vals.join(';')}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

// 站点库下拉选项(与 MP 站点名一致, 避免手输偏差)
async function loadSites() {
  try {
    loadingSites.value = true;
    const res = await props.api.get('site/');
    const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
    siteOptions.value = list.map(x => x?.name).filter(Boolean);
  } catch (e) {
    console.error('获取站点列表失败:', e);
  } finally {
    loadingSites.value = false;
  }
}

// type: 'suffix' | 'domain'; index 非空 = 编辑已有行(数据载入弹框)
function openRuleDlg(type, index = null) {
  ruleDlg.type = type;
  ruleDlg.editingIndex = index;
  if (index !== null) {
    const row = (type === 'suffix' ? suffixRules : domainRules).value[index];
    ruleDlg.site = row?.site || '';
    ruleDlg.values = row?.values?.length ? [...row.values] : [''];
  } else {
    ruleDlg.site = '';
    ruleDlg.values = [''];
  }
  ruleDlg.show = true;
}

function confirmRule() {
  const site = String(ruleDlg.site || '').trim();
  const values = ruleDlg.values.map(v => String(v || '').trim()).filter(Boolean);
  if (!site || !values.length) return
  const target = ruleDlg.type === 'suffix' ? suffixRules : domainRules;
  if (ruleDlg.editingIndex !== null) target.value.splice(ruleDlg.editingIndex, 1);
  // 同站点(忽略大小写)合并去重
  const exist = target.value.find(r => r.site.toLowerCase() === site.toLowerCase());
  if (exist) exist.values = Array.from(new Set([...exist.values, ...values]));
  else target.value.push({ site, values });
  ruleDlg.show = false;
}

onMounted(async () => {
  if (props.initialConfig && typeof props.initialConfig === 'object') {
    Object.keys(DEFAULTS).forEach(key => {
      const v = props.initialConfig[key];
      if (v !== undefined && v !== null) config[key] = v;
    });
  }
  suffixRules.value = parseRules(config.site_suffixes);
  domainRules.value = parseRules(config.site_domains);
  await Promise.all([loadDownloaders(), loadSites()]);
});

async function loadDownloaders() {
  try {
    loadingDownloaders.value = true;
    // MP v2 下载器配置存于 system/setting/Downloaders: {success, data: {value: [{name, type, enabled}]}}
    const res = await props.api.get('system/setting/Downloaders');
    const raw = Array.isArray(res)
      ? res
      : (Array.isArray(res?.data?.value) ? res.data.value : (Array.isArray(res?.data) ? res.data : []));
    downloaderOptions.value = raw
      .filter(x => x && x.enabled !== false)
      .map(x => ({
        title: x.name || x.title || x.type || String(x),
        value: x.name || x.value || x.id || String(x),
      }));
  } catch (e) {
    console.error('获取下载器列表失败:', e);
  } finally {
    loadingDownloaders.value = false;
  }
}

async function saveConfig() {
  saving.value = true;
  error.value = null;
  try {
    config.site_suffixes = serializeRules(suffixRules.value);
    config.site_domains = serializeRules(domainRules.value);
    await props.api.put('plugin/SeedStats', { ...config });
    snackbar.text = '配置已保存';
    snackbar.color = 'success';
    snackbar.show = true;
    emit('save', { ...config });
  } catch (e) {
    console.error('保存配置失败:', e);
    error.value = e?.message || '保存配置失败';
    snackbar.text = error.value;
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    saving.value = false;
  }
}

return (_ctx, _cache) => {
  const _component_v_btn = _resolveComponent("v-btn");
  const _component_v_alert = _resolveComponent("v-alert");
  const _component_v_switch = _resolveComponent("v-switch");
  const _component_v_col = _resolveComponent("v-col");
  const _component_v_row = _resolveComponent("v-row");
  const _component_v_cron_field = _resolveComponent("v-cron-field");
  const _component_v_select = _resolveComponent("v-select");
  const _component_v_spacer = _resolveComponent("v-spacer");
  const _component_v_icon = _resolveComponent("v-icon");
  const _component_v_tooltip = _resolveComponent("v-tooltip");
  const _component_v_table = _resolveComponent("v-table");
  const _component_v_sheet = _resolveComponent("v-sheet");
  const _component_v_textarea = _resolveComponent("v-textarea");
  const _component_v_snackbar = _resolveComponent("v-snackbar");
  const _component_v_card_title = _resolveComponent("v-card-title");
  const _component_v_combobox = _resolveComponent("v-combobox");
  const _component_v_text_field = _resolveComponent("v-text-field");
  const _component_v_card_text = _resolveComponent("v-card-text");
  const _component_v_card_actions = _resolveComponent("v-card-actions");
  const _component_v_card = _resolveComponent("v-card");
  const _component_v_dialog = _resolveComponent("v-dialog");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createElementVNode("div", _hoisted_2, [
      _createVNode(_component_v_btn, {
        variant: "text",
        "prepend-icon": "mdi-chart-donut",
        onClick: _cache[0] || (_cache[0] = $event => (emit('switch')))
      }, {
        default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
          _createTextVNode("查看统计", -1)
        ]))]),
        _: 1
      }),
      _createVNode(_component_v_btn, {
        variant: "text",
        onClick: _cache[1] || (_cache[1] = $event => (emit('close')))
      }, {
        default: _withCtx(() => [...(_cache[17] || (_cache[17] = [
          _createTextVNode("取消", -1)
        ]))]),
        _: 1
      }),
      _createVNode(_component_v_btn, {
        color: "primary",
        loading: saving.value,
        onClick: saveConfig
      }, {
        default: _withCtx(() => [...(_cache[18] || (_cache[18] = [
          _createTextVNode("保存", -1)
        ]))]),
        _: 1
      }, 8, ["loading"])
    ]),
    (error.value)
      ? (_openBlock(), _createBlock(_component_v_alert, {
          key: 0,
          type: "error",
          class: "mb-4",
          variant: "tonal"
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(error.value), 1)
          ]),
          _: 1
        }))
      : _createCommentVNode("", true),
    _cache[39] || (_cache[39] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-2 mb-2" }, "基本设置", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, {
          cols: "12",
          md: "4"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_switch, {
              modelValue: config.enabled,
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((config.enabled) = $event)),
              label: "启用插件",
              color: "primary",
              inset: "",
              density: "compact",
              "hide-details": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "4"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_switch, {
              modelValue: config.local_scan,
              "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((config.local_scan) = $event)),
              label: "启用每日本地对比",
              color: "primary",
              inset: "",
              density: "compact",
              title: "定时对比磁盘,生成可删候选清单(不会自动删)",
              "hide-details": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "4"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_switch, {
              modelValue: config.notify,
              "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((config.notify) = $event)),
              label: "扫描完成通知",
              color: "primary",
              inset: "",
              density: "compact",
              title: "统计/对比完成后的推送提醒",
              "hide-details": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _cache[40] || (_cache[40] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-4 mb-2" }, "调度周期 (5段cron, 宿主时区)", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_cron_field, {
              modelValue: config.seed_cron,
              "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((config.seed_cron) = $event)),
              label: "种子统计 cron",
              placeholder: "0 */12 * * *",
              hint: "留空回退默认(每12小时)",
              "persistent-hint": "",
              variant: "outlined"
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_cron_field, {
              modelValue: config.local_cron,
              "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((config.local_cron) = $event)),
              label: "本地对比 cron",
              placeholder: "20 3 * * *",
              hint: "仅启用本地对比时生效, 默认每天 03:20",
              "persistent-hint": "",
              variant: "outlined"
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _cache[41] || (_cache[41] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-4 mb-2" }, "下载器与站点", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, { cols: "12" }, {
          default: _withCtx(() => [
            _createVNode(_component_v_select, {
              modelValue: config.downloaders,
              "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((config.downloaders) = $event)),
              items: downloaderOptions.value,
              "item-title": "title",
              "item-value": "value",
              label: "参与统计的下载器",
              multiple: "",
              chips: "",
              "closable-chips": "",
              variant: "outlined",
              hint: "留空 = 统计所有已启用下载器",
              "persistent-hint": "",
              loading: loadingDownloaders.value
            }, null, 8, ["modelValue", "items", "loading"])
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createElementVNode("div", _hoisted_3, [
              _cache[20] || (_cache[20] = _createElementVNode("span", { class: "text-subtitle-2" }, "站点官方后缀 (判定官组)", -1)),
              _createVNode(_component_v_spacer),
              _createVNode(_component_v_btn, {
                size: "x-small",
                color: "primary",
                variant: "tonal",
                "prepend-icon": "mdi-plus",
                onClick: _cache[8] || (_cache[8] = $event => (openRuleDlg('suffix')))
              }, {
                default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                  _createTextVNode("新增", -1)
                ]))]),
                _: 1
              })
            ]),
            _createVNode(_component_v_sheet, {
              variant: "outlined",
              rounded: "",
              style: {"min-height":"84px","max-height":"170px","overflow-y":"auto"}
            }, {
              default: _withCtx(() => [
                (suffixRules.value.length)
                  ? (_openBlock(), _createBlock(_component_v_table, {
                      key: 0,
                      density: "compact"
                    }, {
                      default: _withCtx(() => [
                        _createElementVNode("tbody", null, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(suffixRules.value, (r, i) => {
                            return (_openBlock(), _createElementBlock("tr", {
                              key: 'sf' + i
                            }, [
                              _createElementVNode("td", _hoisted_4, _toDisplayString(r.site), 1),
                              _createElementVNode("td", _hoisted_5, _toDisplayString(r.values.join(';')), 1),
                              _createElementVNode("td", _hoisted_6, [
                                _createVNode(_component_v_btn, {
                                  icon: "",
                                  size: "x-small",
                                  variant: "text",
                                  onClick: $event => (openRuleDlg('suffix', i))
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_icon, { size: "small" }, {
                                      default: _withCtx(() => [...(_cache[21] || (_cache[21] = [
                                        _createTextVNode("mdi-pencil-outline", -1)
                                      ]))]),
                                      _: 1
                                    }),
                                    _createVNode(_component_v_tooltip, {
                                      activator: "parent",
                                      location: "top"
                                    }, {
                                      default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
                                        _createTextVNode("编辑", -1)
                                      ]))]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["onClick"]),
                                _createVNode(_component_v_btn, {
                                  icon: "",
                                  size: "x-small",
                                  variant: "text",
                                  color: "error",
                                  onClick: $event => (suffixRules.value.splice(i, 1))
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_icon, { size: "small" }, {
                                      default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                                        _createTextVNode("mdi-delete-outline", -1)
                                      ]))]),
                                      _: 1
                                    }),
                                    _createVNode(_component_v_tooltip, {
                                      activator: "parent",
                                      location: "top"
                                    }, {
                                      default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                                        _createTextVNode("删除", -1)
                                      ]))]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["onClick"])
                              ])
                            ]))
                          }), 128))
                        ])
                      ]),
                      _: 1
                    }))
                  : (_openBlock(), _createElementBlock("div", _hoisted_7, " 暂无规则, 点击\"新增\"添加(站点: 后缀) "))
              ]),
              _: 1
            }),
            _cache[25] || (_cache[25] = _createElementVNode("div", { class: "text-caption text-medium-emphasis mt-1" }, "命中后缀的做种种子判定为官组", -1))
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createElementVNode("div", _hoisted_8, [
              _cache[27] || (_cache[27] = _createElementVNode("span", { class: "text-subtitle-2" }, "站点域名补充", -1)),
              _createVNode(_component_v_spacer),
              _createVNode(_component_v_btn, {
                size: "x-small",
                color: "primary",
                variant: "tonal",
                "prepend-icon": "mdi-plus",
                onClick: _cache[9] || (_cache[9] = $event => (openRuleDlg('domain')))
              }, {
                default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                  _createTextVNode("新增", -1)
                ]))]),
                _: 1
              })
            ]),
            _createVNode(_component_v_sheet, {
              variant: "outlined",
              rounded: "",
              style: {"min-height":"84px","max-height":"170px","overflow-y":"auto"}
            }, {
              default: _withCtx(() => [
                (domainRules.value.length)
                  ? (_openBlock(), _createBlock(_component_v_table, {
                      key: 0,
                      density: "compact"
                    }, {
                      default: _withCtx(() => [
                        _createElementVNode("tbody", null, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(domainRules.value, (r, i) => {
                            return (_openBlock(), _createElementBlock("tr", {
                              key: 'dm' + i
                            }, [
                              _createElementVNode("td", _hoisted_9, _toDisplayString(r.site), 1),
                              _createElementVNode("td", _hoisted_10, _toDisplayString(r.values.join(';')), 1),
                              _createElementVNode("td", _hoisted_11, [
                                _createVNode(_component_v_btn, {
                                  icon: "",
                                  size: "x-small",
                                  variant: "text",
                                  onClick: $event => (openRuleDlg('domain', i))
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_icon, { size: "small" }, {
                                      default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                                        _createTextVNode("mdi-pencil-outline", -1)
                                      ]))]),
                                      _: 1
                                    }),
                                    _createVNode(_component_v_tooltip, {
                                      activator: "parent",
                                      location: "top"
                                    }, {
                                      default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                                        _createTextVNode("编辑", -1)
                                      ]))]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["onClick"]),
                                _createVNode(_component_v_btn, {
                                  icon: "",
                                  size: "x-small",
                                  variant: "text",
                                  color: "error",
                                  onClick: $event => (domainRules.value.splice(i, 1))
                                }, {
                                  default: _withCtx(() => [
                                    _createVNode(_component_v_icon, { size: "small" }, {
                                      default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
                                        _createTextVNode("mdi-delete-outline", -1)
                                      ]))]),
                                      _: 1
                                    }),
                                    _createVNode(_component_v_tooltip, {
                                      activator: "parent",
                                      location: "top"
                                    }, {
                                      default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                                        _createTextVNode("删除", -1)
                                      ]))]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }, 8, ["onClick"])
                              ])
                            ]))
                          }), 128))
                        ])
                      ]),
                      _: 1
                    }))
                  : (_openBlock(), _createElementBlock("div", _hoisted_12, " 暂无规则, 点击\"新增\"添加(站点: 域名) "))
              ]),
              _: 1
            }),
            _cache[32] || (_cache[32] = _createElementVNode("div", { class: "text-caption text-medium-emphasis mt-1" }, "系统已收录站点按 tracker 域名自动识别, 此处补充别名域名", -1))
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _cache[42] || (_cache[42] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-4 mb-2" }, "本地对比路径", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_textarea, {
              modelValue: config.path_map,
              "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => ((config.path_map) = $event)),
              label: "磁盘路径映射(远程→本地)",
              rows: "3",
              variant: "outlined",
              hint: "每行一项, 格式: 远程前缀=本地根目录。启用本地对比且路径不一致时必填",
              "persistent-hint": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_textarea, {
              modelValue: config.exclude_paths,
              "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => ((config.exclude_paths) = $event)),
              label: "本地对比排除路径",
              rows: "3",
              variant: "outlined",
              hint: "每行一项, 命中的绝对前缀将被跳过",
              "persistent-hint": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _createVNode(_component_v_snackbar, {
      modelValue: snackbar.show,
      "onUpdate:modelValue": _cache[12] || (_cache[12] = $event => ((snackbar.show) = $event)),
      color: snackbar.color,
      timeout: "2500"
    }, {
      default: _withCtx(() => [
        _createTextVNode(_toDisplayString(snackbar.text), 1)
      ]),
      _: 1
    }, 8, ["modelValue", "color"]),
    _createVNode(_component_v_dialog, {
      modelValue: ruleDlg.show,
      "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => ((ruleDlg.show) = $event)),
      "max-width": "430"
    }, {
      default: _withCtx(() => [
        _createVNode(_component_v_card, null, {
          default: _withCtx(() => [
            _createVNode(_component_v_card_title, { class: "text-subtitle-1 font-weight-bold" }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString((ruleDlg.editingIndex !== null ? '编辑' : '新增') + (ruleDlg.type === 'suffix' ? '官组后缀' : '站点域名')), 1)
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_text, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_combobox, {
                  modelValue: ruleDlg.site,
                  "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => ((ruleDlg.site) = $event)),
                  items: siteOptions.value,
                  loading: loadingSites.value,
                  label: "站点名称",
                  variant: "outlined",
                  hint: "可从站点库下拉选择, 也可手动输入别名",
                  "persistent-hint": ""
                }, null, 8, ["modelValue", "items", "loading"]),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(ruleDlg.values, (v, i) => {
                  return (_openBlock(), _createElementBlock("div", {
                    key: 'val' + i,
                    class: "d-flex align-center mt-2"
                  }, [
                    _createVNode(_component_v_text_field, {
                      modelValue: ruleDlg.values[i],
                      "onUpdate:modelValue": $event => ((ruleDlg.values[i]) = $event),
                      variant: "outlined",
                      density: "comfortable",
                      "hide-details": "",
                      label: i === 0 ? (ruleDlg.type === 'suffix' ? '官组后缀(不区分大小写)' : '补充域名') : '',
                      placeholder: ruleDlg.type === 'suffix' ? '如 CHD' : '如 pt.example.net'
                    }, null, 8, ["modelValue", "onUpdate:modelValue", "label", "placeholder"]),
                    _createVNode(_component_v_btn, {
                      icon: "",
                      size: "x-small",
                      variant: "text",
                      color: "primary",
                      class: "ml-1 flex-grow-0",
                      onClick: $event => (ruleDlg.values.splice(i + 1, 0, ''))
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_icon, null, {
                          default: _withCtx(() => [...(_cache[33] || (_cache[33] = [
                            _createTextVNode("mdi-plus", -1)
                          ]))]),
                          _: 1
                        }),
                        _createVNode(_component_v_tooltip, {
                          activator: "parent",
                          location: "top"
                        }, {
                          default: _withCtx(() => [...(_cache[34] || (_cache[34] = [
                            _createTextVNode("加一项", -1)
                          ]))]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, ["onClick"]),
                    _createVNode(_component_v_btn, {
                      icon: "",
                      size: "x-small",
                      variant: "text",
                      color: "error",
                      class: "ml-1 flex-grow-0",
                      disabled: ruleDlg.values.length <= 1,
                      onClick: $event => (ruleDlg.values.splice(i, 1))
                    }, {
                      default: _withCtx(() => [
                        _createVNode(_component_v_icon, null, {
                          default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
                            _createTextVNode("mdi-minus", -1)
                          ]))]),
                          _: 1
                        }),
                        _createVNode(_component_v_tooltip, {
                          activator: "parent",
                          location: "top"
                        }, {
                          default: _withCtx(() => [...(_cache[36] || (_cache[36] = [
                            _createTextVNode("删除此项", -1)
                          ]))]),
                          _: 1
                        })
                      ]),
                      _: 1
                    }, 8, ["disabled", "onClick"])
                  ]))
                }), 128))
              ]),
              _: 1
            }),
            _createVNode(_component_v_card_actions, null, {
              default: _withCtx(() => [
                _createVNode(_component_v_spacer),
                _createVNode(_component_v_btn, {
                  variant: "text",
                  onClick: _cache[14] || (_cache[14] = $event => (ruleDlg.show = false))
                }, {
                  default: _withCtx(() => [...(_cache[37] || (_cache[37] = [
                    _createTextVNode("取消", -1)
                  ]))]),
                  _: 1
                }),
                _createVNode(_component_v_btn, {
                  color: "primary",
                  disabled: !ruleDlg.site || !ruleDlg.values.some(v => String(v || '').trim()),
                  onClick: confirmRule
                }, {
                  default: _withCtx(() => [...(_cache[38] || (_cache[38] = [
                    _createTextVNode("确定", -1)
                  ]))]),
                  _: 1
                }, 8, ["disabled"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"])
  ]))
}
}

};
const Config = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-66a61e6c"]]);

export { _export_sfc as _, Config as default };
