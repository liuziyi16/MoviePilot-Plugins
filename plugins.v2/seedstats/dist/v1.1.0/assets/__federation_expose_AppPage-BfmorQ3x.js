import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { _ as _export_sfc } from './_plugin-vue_export-helper-pcqpp-6-.js';

// 兼容 MoviePilot API 包装器与原始响应的两种返回形态。
function unwrapResponse(response) {
  if (response && Object.prototype.hasOwnProperty.call(response, 'data') && response.success !== undefined) {
    return response.data
  }
  return response?.data ?? response
}

// 字节 -> 可读大小
function formatSize(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = num;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]}`
}

// 千位分隔（数量）
function fmtInt(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString() : '0'
}

// 取状态别名中文（后端归一化后状态即中文或原文）。
function fmtRatio(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00'
}

const {createTextVNode:_createTextVNode,resolveComponent:_resolveComponent,withCtx:_withCtx,createVNode:_createVNode,toDisplayString:_toDisplayString,Fragment:_Fragment,openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,createBlock:_createBlock,unref:_unref,renderList:_renderList,normalizeClass:_normalizeClass,mergeProps:_mergeProps} = await importShared('vue');


const _hoisted_1 = {
  class: "ss-root pa-2",
  style: {"max-width":"1180px"}
};
const _hoisted_2 = { class: "d-flex align-center mb-2 flex-wrap ga-2" };
const _hoisted_3 = { key: 3 };
const _hoisted_4 = { class: "text-h6" };
const _hoisted_5 = { class: "text-h6" };
const _hoisted_6 = { class: "text-h6" };
const _hoisted_7 = { class: "text-h6" };
const _hoisted_8 = { class: "text-h6" };
const _hoisted_9 = { key: 1 };
const _hoisted_10 = { class: "pa-2 d-flex flex-wrap ga-1" };
const _hoisted_11 = {
  key: 0,
  class: "text-grey"
};
const _hoisted_12 = { class: "pa-2 max-h-200 overflow-auto" };
const _hoisted_13 = { class: "text-body-2" };
const _hoisted_14 = { class: "text-grey" };
const _hoisted_15 = {
  key: 0,
  class: "text-grey text-caption"
};
const _hoisted_16 = { key: 4 };
const _hoisted_17 = { class: "text-h6" };
const _hoisted_18 = { class: "text-h6 text-error" };
const _hoisted_19 = { class: "text-h6 text-primary" };
const _hoisted_20 = { class: "text-h6" };
const _hoisted_21 = { class: "d-flex flex-wrap ga-1 mt-2" };
const _hoisted_22 = { class: "text-grey" };
const _hoisted_23 = { class: "text-grey" };
const _hoisted_24 = { class: "text-caption" };
const _hoisted_25 = {
  key: 1,
  class: "text-grey text-caption mt-2"
};
const _hoisted_26 = { class: "d-flex align-center ga-2 mb-2" };
const _hoisted_27 = { class: "text-grey" };

const {ref,computed,onMounted,onBeforeUnmount} = await importShared('vue');


const _sfc_main = {
  __name: 'AppPage',
  props: {
  api: { type: Object, default: () => ({}) },
  pluginId: { type: String, default: 'SeedStats' },
  hideTitle: { type: Boolean, default: false },
},
  emits: ['message'],
  setup(__props, { expose: __expose, emit: __emit }) {

const props = __props;

const pluginBase = computed(() => `plugin/${props.pluginId || 'SeedStats'}`);

// ---------- 视图模式(单页双 Tab:统计 / 本地) ----------
const mode = ref('seed');

// ---------- 种子统计 ----------
const seedLoading = ref(false);
const seed = ref(null);
const seedEmpty = ref(true);

const stats = computed(() => seed.value || {});
const overall = computed(() => stats.value.overall || {});
const siteRows = computed(() => stats.value.sites || []);
const groupRows = computed(() => stats.value.official_groups || []);
const stateRows = computed(() => stats.value.states || []);
const unidentified = computed(() => stats.value.unidentified || []);

// ---------- 本地清理 ----------
const localLoading = ref(false);
const local = ref(null);
const localEmpty = ref(true);
const selected = ref([]); // 选中的 removable.rel

const ldata = computed(() => local.value || {});
const removables = computed(() => ldata.value.removable || []);
const emptyDirs = computed(() => ldata.value.empty_dirs || []);

// ---------- 通用 ----------
const toast = ref('');
const errorMsg = ref('');

// 简化通知:官方主应用会把 toast/snack 注入 props;这里做兜底
const emit = __emit;
function toastMsg(text, color) {
  toast.value = text;
  emit('message', { text, color: color || 'info' });
  setTimeout(() => (toast.value = ''), 3000);
}

// ---------- 路径映射校验(本地清理 Tab) ----------
// 把当前表单里的 path_map 文本粘贴到这里做存在校验;
// 也可留空,后端会读 self._path_map(已保存到插件配置项的最新值)
const pathMapInput = ref('');
const pathMapCheckLoading = ref(false);
const pathMapCheckResult = ref(null);   // 后端返回的 { ok, summary, lines, source }
const pathMapCheckError = ref('');

// 状态 -> 颜色 + 图标。集中放便于前端一致渲染
const STATUS_META = {
  ok:          { color: 'success', icon: 'mdi-check-circle',     label: 'OK' },
  bad_remote:  { color: 'warning', icon: 'mdi-cloud-alert',     label: '远程缺失' },
  bad_local:   { color: 'warning', icon: 'mdi-folder-alert',    label: '本地缺失' },
  bad_both:    { color: 'error',   icon: 'mdi-close-circle',    label: '两端均缺' },
  bad_format:  { color: 'error',   icon: 'mdi-alert-circle',    label: '格式错' },
};
function statusMeta(s) { return STATUS_META[s] || STATUS_META.bad_format }

async function checkPathMap() {
  pathMapCheckLoading.value = true;
  pathMapCheckError.value = '';
  try {
    const body = { raw: pathMapInput.value || '' };
    const r = await props.api.post(`${pluginBase.value}/validate_path_map`, body);
    const d = unwrapResponse(r);
    // 兼容后端返回 { ok, summary, lines, source } 也兼容顶层包 data
    const payload = d && d.data ? d.data : d;
    pathMapCheckResult.value = payload || null;
    if (!payload) {
      pathMapCheckError.value = '后端未返回数据';
    }
  } catch (e) {
    pathMapCheckError.value = e?.message || '校验失败';
    pathMapCheckResult.value = null;
  } finally {
    pathMapCheckLoading.value = false;
  }
}

// ================= 数据加载 =================
async function loadSeed() {
  seedLoading.value = true;
  errorMsg.value = '';
  try {
    const r = await props.api.get(`${pluginBase.value}/data`);
    const d = unwrapResponse(r);
    if (d && d.empty) {
      seed.value = null;
      seedEmpty.value = true;
    } else {
      seed.value = d.data || d;
      seedEmpty.value = false;
    }
  } catch (e) {
    errorMsg.value = e?.message || '加载统计失败';
  } finally {
    seedLoading.value = false;
  }
}

async function loadLocal() {
  localLoading.value = true;
  errorMsg.value = '';
  try {
    const r = await props.api.get(`${pluginBase.value}/local`);
    const d = unwrapResponse(r);
    local.value = d.data || d;
    localEmpty.value = !(local.value && local.value.removable_count >= 0);
  } catch (e) {
    errorMsg.value = e?.message || '加载本地结果失败';
  } finally {
    localLoading.value = false;
  }
}

// ================= 触发扫描 =================
async function triggerScan(which) {
  const body = which === 'local' ? { local: true } : {};
  try {
    const r = await props.api.post(`${pluginBase.value}/scan`, body);
    const d = unwrapResponse(r);
    if (d && d.ok === false) {
      toastMsg(d.err || '已有扫描进行中', 'error');
      return false
    }
    // 扫描后台进行,轮询等待结果
    pollForever();
    return true
  } catch (e) {
    toastMsg(e?.message || '触发扫描失败', 'error');
    return false
  }
}

// ---------- 轮询:触发扫描后定时刷新对应数据直到 updated_at 变化 ----------
let pollTimer = null;
const requestOf = {
  seed: loadSeed,
  local: loadLocal,
};

// 在 scan POST 成功后持续刷新直到数据时间戳推进(扫描完成)。
function pollForever(interval = 2500, max = 40) {
  stopPoll();
  const modeNow = mode.value;
  // 保留开始时间戳便于判断
  pollTimer = setInterval(async () => {
    try {
      const before = modeNow === 'local' ? ldata.value.updated_at : stats.value.updated_at;
      await requestOf[modeNow]?.();
      const after = modeNow === 'local' ? ldata.value.updated_at : stats.value.updated_at;
      if (after && before && after !== before) {
        stopPoll();
        toastMsg('扫描完成', 'success');
      }
    } catch (e) {
      stopPoll();
    }
    max -= 1;
    if (max <= 0) stopPoll();
  }, interval);
}
function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ================= 本地清理操作 =================
function toggleAll(ev) {
  selected.value = ev ? removables.value.map(x => x.rel) : [];
}

function selectedSize() {
  return removables.value
    .filter(x => selected.value.includes(x.rel))
    .reduce((s, x) => s + Number(x.size || 0), 0)
}

async function deleteSelected() {
  const rels = selected.value;
  if (!rels.length) return
  try {
    const r = await props.api.post(`${pluginBase.value}/delete`, { paths: rels });
    const d = unwrapResponse(r);
    const res = d.result || {};
    const done = (res.deleted || []).length;
    const rej = (res.rejected || []).length;
    const fail = (res.failed || []).length;
    selected.value = [];
    toastMsg(`删除完成:成功 ${done},拒绝 ${rej},失败 ${fail}`, rej || fail ? 'warning' : 'success');
    // 删除后后台已重扫,轮询刷新
    setTimeout(loadLocal, 1200);
  } catch (e) {
    toastMsg(e?.message || '删除失败', 'error');
  }
}

async function cleanEmptyDirs() {
  try {
    const r = await props.api.post(`${pluginBase.value}/clean_empty`, {});
    const d = unwrapResponse(r);
    const removed = (d.removed || []).length;
    toastMsg(`空目录已清理 ${removed} 个`, removed ? 'success' : 'info');
    setTimeout(loadLocal, 800);
  } catch (e) {
    toastMsg(e?.message || '清理失败', 'error');
  }
}

// ================= 生命周期 =================
onMounted(() => {
  loadSeed();
});
onBeforeUnmount(stopPoll);

__expose({ loadSeed, loadLocal });

return (_ctx, _cache) => {
  const _component_v_icon = _resolveComponent("v-icon");
  const _component_v_btn = _resolveComponent("v-btn");
  const _component_v_btn_toggle = _resolveComponent("v-btn-toggle");
  const _component_v_spacer = _resolveComponent("v-spacer");
  const _component_v_chip = _resolveComponent("v-chip");
  const _component_v_alert = _resolveComponent("v-alert");
  const _component_v_progress_linear = _resolveComponent("v-progress-linear");
  const _component_v_card_text = _resolveComponent("v-card-text");
  const _component_v_card = _resolveComponent("v-card");
  const _component_v_col = _resolveComponent("v-col");
  const _component_v_row = _resolveComponent("v-row");
  const _component_v_card_title = _resolveComponent("v-card-title");
  const _component_v_data_table = _resolveComponent("v-data-table");
  const _component_v_textarea = _resolveComponent("v-textarea");
  const _component_v_tooltip = _resolveComponent("v-tooltip");
  const _component_v_checkbox = _resolveComponent("v-checkbox");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createElementVNode("div", _hoisted_2, [
      _createVNode(_component_v_btn_toggle, {
        modelValue: mode.value,
        "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((mode).value = $event)),
        density: "compact",
        mandatory: "",
        rounded: "lg"
      }, {
        default: _withCtx(() => [
          _createVNode(_component_v_btn, {
            value: "seed",
            size: "small"
          }, {
            default: _withCtx(() => [
              _createVNode(_component_v_icon, { left: "" }, {
                default: _withCtx(() => [...(_cache[7] || (_cache[7] = [
                  _createTextVNode("mdi-radar", -1)
                ]))]),
                _: 1
              }),
              _cache[8] || (_cache[8] = _createTextVNode("做种统计", -1))
            ]),
            _: 1
          }),
          _createVNode(_component_v_btn, {
            value: "local",
            size: "small"
          }, {
            default: _withCtx(() => [
              _createVNode(_component_v_icon, { left: "" }, {
                default: _withCtx(() => [...(_cache[9] || (_cache[9] = [
                  _createTextVNode("mdi-folder-search", -1)
                ]))]),
                _: 1
              }),
              _cache[10] || (_cache[10] = _createTextVNode("本地清理", -1))
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["modelValue"]),
      _createVNode(_component_v_spacer),
      (mode.value === 'seed')
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
            _createVNode(_component_v_chip, {
              density: "compact",
              color: seedLoading.value ? 'grey' : 'primary'
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(seedLoading.value ? '加载中…' : (stats.value.updated_at || '尚未扫描')), 1)
              ]),
              _: 1
            }, 8, ["color"]),
            _createVNode(_component_v_btn, {
              density: "compact",
              color: "primary",
              variant: "flat",
              size: "small",
              loading: seedLoading.value,
              onClick: _cache[1] || (_cache[1] = $event => (loadSeed()))
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, { left: "" }, {
                  default: _withCtx(() => [...(_cache[11] || (_cache[11] = [
                    _createTextVNode("mdi-refresh", -1)
                  ]))]),
                  _: 1
                }),
                _cache[12] || (_cache[12] = _createTextVNode("刷新 ", -1))
              ]),
              _: 1
            }, 8, ["loading"]),
            _createVNode(_component_v_btn, {
              density: "compact",
              color: "info",
              variant: "tonal",
              size: "small",
              onClick: _cache[2] || (_cache[2] = $event => (triggerScan('seed').then(() => toastMsg('已开始后台统计…', 'info'))))
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, { left: "" }, {
                  default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
                    _createTextVNode("mdi-play", -1)
                  ]))]),
                  _: 1
                }),
                _cache[14] || (_cache[14] = _createTextVNode("扫描 ", -1))
              ]),
              _: 1
            })
          ], 64))
        : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
            _createVNode(_component_v_chip, {
              density: "compact",
              color: localLoading.value ? 'grey' : 'primary'
            }, {
              default: _withCtx(() => [
                _createTextVNode(_toDisplayString(localLoading.value ? '加载中…' : (ldata.value.updated_at || '尚未扫描')), 1)
              ]),
              _: 1
            }, 8, ["color"]),
            _createVNode(_component_v_btn, {
              density: "compact",
              color: "info",
              variant: "tonal",
              size: "small",
              onClick: _cache[3] || (_cache[3] = $event => (triggerScan('local')))
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, { left: "" }, {
                  default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
                    _createTextVNode("mdi-play", -1)
                  ]))]),
                  _: 1
                }),
                _cache[16] || (_cache[16] = _createTextVNode("本地扫描 ", -1))
              ]),
              _: 1
            })
          ], 64))
    ]),
    (toast.value)
      ? (_openBlock(), _createBlock(_component_v_alert, {
          key: 0,
          density: "compact",
          type: "success",
          variant: "tonal",
          class: "mb-2"
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(toast.value), 1)
          ]),
          _: 1
        }))
      : _createCommentVNode("", true),
    (errorMsg.value)
      ? (_openBlock(), _createBlock(_component_v_alert, {
          key: 1,
          density: "compact",
          type: "error",
          variant: "tonal",
          class: "mb-2"
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(errorMsg.value), 1)
          ]),
          _: 1
        }))
      : _createCommentVNode("", true),
    (seedLoading.value || localLoading.value)
      ? (_openBlock(), _createBlock(_component_v_progress_linear, {
          key: 2,
          indeterminate: "",
          color: "primary",
          class: "mb-2"
        }))
      : _createCommentVNode("", true),
    (mode.value === 'seed')
      ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
          _createVNode(_component_v_row, { class: "mb-2" }, {
            default: _withCtx(() => [
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[17] || (_cache[17] = _createElementVNode("div", { class: "text-caption text-grey" }, "做种任务", -1)),
                          _createElementVNode("div", _hoisted_4, _toDisplayString(_unref(fmtInt)(overall.value.count)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[18] || (_cache[18] = _createElementVNode("div", { class: "text-caption text-grey" }, "总量", -1)),
                          _createElementVNode("div", _hoisted_5, _toDisplayString(_unref(formatSize)(overall.value.size)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[19] || (_cache[19] = _createElementVNode("div", { class: "text-caption text-grey" }, "做种中", -1)),
                          _createElementVNode("div", _hoisted_6, _toDisplayString(_unref(fmtInt)(overall.value.seeding_count)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[20] || (_cache[20] = _createElementVNode("div", { class: "text-caption text-grey" }, "做种体积", -1)),
                          _createElementVNode("div", _hoisted_7, _toDisplayString(_unref(formatSize)(overall.value.seeding_size)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[21] || (_cache[21] = _createElementVNode("div", { class: "text-caption text-grey" }, "平均分享率", -1)),
                          _createElementVNode("div", _hoisted_8, _toDisplayString(_unref(fmtRatio)(overall.value.avg_ratio)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          _createVNode(_component_v_card, {
            class: "mb-2",
            variant: "outlined"
          }, {
            default: _withCtx(() => [
              _createVNode(_component_v_card_title, { class: "text-subtitle-1 py-2" }, {
                default: _withCtx(() => [...(_cache[22] || (_cache[22] = [
                  _createTextVNode("站点分布", -1)
                ]))]),
                _: 1
              }),
              _createVNode(_component_v_data_table, {
                headers: [
            { title: '站点', key: 'site' },
            { title: '种子数', key: 'count' },
            { title: '体积', key: 'size' },
            { title: '做种中', key: 'seeding_count' },
            { title: '官组', key: 'official' },
          ],
                items: siteRows.value,
                "items-per-page": -1,
                density: "compact",
                class: "elevation-0"
              }, {
                "item.site": _withCtx(({ item }) => [
                  _createElementVNode("b", null, _toDisplayString(item.site), 1)
                ]),
                "item.count": _withCtx(({ item }) => [
                  _createTextVNode(_toDisplayString(_unref(fmtInt)(item.count)), 1)
                ]),
                "item.size": _withCtx(({ item }) => [
                  _createTextVNode(_toDisplayString(_unref(formatSize)(item.size)), 1)
                ]),
                "item.seeding_count": _withCtx(({ item }) => [
                  _createTextVNode(_toDisplayString(_unref(fmtInt)(item.seeding_count)), 1)
                ]),
                "item.official": _withCtx(({ item }) => [
                  (Number(item.official) > 0)
                    ? (_openBlock(), _createBlock(_component_v_chip, {
                        key: 0,
                        size: "x-small",
                        color: "purple"
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(item.official), 1)
                        ]),
                        _: 2
                      }, 1024))
                    : (_openBlock(), _createElementBlock("span", _hoisted_9, "—"))
                ]),
                _: 1
              }, 8, ["items"])
            ]),
            _: 1
          }),
          (groupRows.value.length)
            ? (_openBlock(), _createBlock(_component_v_card, {
                key: 0,
                class: "mb-2",
                variant: "outlined"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card_title, { class: "text-subtitle-1 py-2" }, {
                    default: _withCtx(() => [
                      _cache[23] || (_cache[23] = _createTextVNode(" 官方官组做种 ", -1)),
                      _createVNode(_component_v_chip, {
                        size: "small",
                        color: "purple"
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(groupRows.value.length) + " 站", 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_v_data_table, {
                    headers: [
            { title: '站点', key: 'site' },
            { title: '官组数', key: 'count' },
            { title: '体积', key: 'size' },
            { title: '做种中', key: 'seeding_count' },
          ],
                    items: groupRows.value,
                    "items-per-page": -1,
                    density: "compact"
                  }, {
                    "item.count": _withCtx(({ item }) => [
                      _createTextVNode(_toDisplayString(_unref(fmtInt)(item.count)), 1)
                    ]),
                    "item.size": _withCtx(({ item }) => [
                      _createTextVNode(_toDisplayString(_unref(formatSize)(item.size)), 1)
                    ]),
                    "item.seeding_count": _withCtx(({ item }) => [
                      _createTextVNode(_toDisplayString(_unref(fmtInt)(item.seeding_count)), 1)
                    ]),
                    _: 1
                  }, 8, ["items"])
                ]),
                _: 1
              }))
            : _createCommentVNode("", true),
          _createVNode(_component_v_card, {
            class: "mb-2",
            variant: "outlined"
          }, {
            default: _withCtx(() => [
              _createVNode(_component_v_card_title, { class: "text-subtitle-1 py-2" }, {
                default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                  _createTextVNode("任务状态分布", -1)
                ]))]),
                _: 1
              }),
              _createElementVNode("div", _hoisted_10, [
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(stateRows.value, (s) => {
                  return (_openBlock(), _createBlock(_component_v_chip, {
                    key: s.state,
                    density: "compact",
                    variant: "tonal"
                  }, {
                    default: _withCtx(() => [
                      _createTextVNode(_toDisplayString(s.state) + " · ", 1),
                      _createElementVNode("b", null, _toDisplayString(_unref(fmtInt)(s.count)), 1)
                    ]),
                    _: 2
                  }, 1024))
                }), 128)),
                (!stateRows.value.length)
                  ? (_openBlock(), _createElementBlock("span", _hoisted_11, "暂无数据"))
                  : _createCommentVNode("", true)
              ])
            ]),
            _: 1
          }),
          (unidentified.value.length)
            ? (_openBlock(), _createBlock(_component_v_card, {
                key: 1,
                variant: "outlined"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card_title, { class: "text-subtitle-1 py-2" }, {
                    default: _withCtx(() => [...(_cache[25] || (_cache[25] = [
                      _createTextVNode("未识别站点种子(供排查站点识别)", -1)
                    ]))]),
                    _: 1
                  }),
                  _createElementVNode("div", _hoisted_12, [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(unidentified.value.slice(0, 40), (u, i) => {
                      return (_openBlock(), _createElementBlock("div", {
                        key: i,
                        class: "d-flex justify-space-between"
                      }, [
                        _createElementVNode("span", _hoisted_13, _toDisplayString(u.name), 1),
                        _createElementVNode("small", _hoisted_14, _toDisplayString(u.downloader), 1)
                      ]))
                    }), 128)),
                    (unidentified.value.length > 40)
                      ? (_openBlock(), _createElementBlock("span", _hoisted_15, " 还有 " + _toDisplayString(unidentified.value.length - 40) + " 项未显示 ", 1))
                      : _createCommentVNode("", true)
                  ])
                ]),
                _: 1
              }))
            : _createCommentVNode("", true)
        ]))
      : (_openBlock(), _createElementBlock("div", _hoisted_16, [
          _createVNode(_component_v_row, { class: "mb-2" }, {
            default: _withCtx(() => [
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[26] || (_cache[26] = _createElementVNode("div", { class: "text-caption text-grey" }, "冗余候选", -1)),
                          _createElementVNode("div", _hoisted_17, _toDisplayString(_unref(fmtInt)(ldata.value.removable_count)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[27] || (_cache[27] = _createElementVNode("div", { class: "text-caption text-grey" }, "可释放空间", -1)),
                          _createElementVNode("div", _hoisted_18, _toDisplayString(_unref(formatSize)(ldata.value.removable_size)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[28] || (_cache[28] = _createElementVNode("div", { class: "text-caption text-grey" }, "扫描根目录", -1)),
                          _createElementVNode("div", _hoisted_19, _toDisplayString(_unref(fmtInt)(ldata.value.roots?.length)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }),
              _createVNode(_component_v_col, {
                cols: "6",
                sm: "4",
                md: "2"
              }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_card, { variant: "tonal" }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_card_text, { class: "pa-2 text-center" }, {
                        default: _withCtx(() => [
                          _cache[29] || (_cache[29] = _createElementVNode("div", { class: "text-caption text-grey" }, "空目录", -1)),
                          _createElementVNode("div", _hoisted_20, _toDisplayString(_unref(fmtInt)(emptyDirs.value.length)), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          _createVNode(_component_v_card, {
            class: "mb-2",
            variant: "outlined"
          }, {
            default: _withCtx(() => [
              _createVNode(_component_v_card_title, { class: "text-subtitle-1 py-2 d-flex align-center ga-2" }, {
                default: _withCtx(() => [
                  _createVNode(_component_v_icon, null, {
                    default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
                      _createTextVNode("mdi-map-marker-path", -1)
                    ]))]),
                    _: 1
                  }),
                  _cache[33] || (_cache[33] = _createTextVNode(" 磁盘路径映射校验 ", -1)),
                  _createVNode(_component_v_spacer),
                  _createVNode(_component_v_btn, {
                    density: "compact",
                    color: "primary",
                    variant: "flat",
                    size: "small",
                    loading: pathMapCheckLoading.value,
                    onClick: checkPathMap
                  }, {
                    default: _withCtx(() => [
                      _createVNode(_component_v_icon, { left: "" }, {
                        default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                          _createTextVNode("mdi-check-decagram", -1)
                        ]))]),
                        _: 1
                      }),
                      _cache[32] || (_cache[32] = _createTextVNode("校验 ", -1))
                    ]),
                    _: 1
                  }, 8, ["loading"])
                ]),
                _: 1
              }),
              _createVNode(_component_v_card_text, null, {
                default: _withCtx(() => [
                  _createVNode(_component_v_textarea, {
                    modelValue: pathMapInput.value,
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((pathMapInput).value = $event)),
                    label: "path_map (留空则校验已保存到插件配置的值)",
                    rows: "3",
                    density: "compact",
                    variant: "outlined",
                    hint: "每行 / 每 | 一项;格式: 远程前缀 = 本地根目录 (也支持 -> / =>)。校验只检查前缀是否存在,不写任何文件。",
                    "persistent-hint": ""
                  }, null, 8, ["modelValue"]),
                  (pathMapCheckError.value)
                    ? (_openBlock(), _createBlock(_component_v_alert, {
                        key: 0,
                        type: "error",
                        density: "compact",
                        variant: "tonal",
                        class: "mt-2"
                      }, {
                        default: _withCtx(() => [
                          _createTextVNode(_toDisplayString(pathMapCheckError.value), 1)
                        ]),
                        _: 1
                      }))
                    : _createCommentVNode("", true),
                  (pathMapCheckResult.value)
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                        _createElementVNode("div", _hoisted_21, [
                          _createVNode(_component_v_chip, {
                            size: "small",
                            color: pathMapCheckResult.value.ok ? 'success' : 'error',
                            variant: "flat"
                          }, {
                            default: _withCtx(() => [
                              _createVNode(_component_v_icon, { left: "" }, {
                                default: _withCtx(() => [
                                  _createTextVNode(_toDisplayString(pathMapCheckResult.value.ok ? 'mdi-check-circle' : 'mdi-alert-circle'), 1)
                                ]),
                                _: 1
                              }),
                              _createTextVNode(" " + _toDisplayString(pathMapCheckResult.value.ok ? '全部通过' : '存在异常'), 1)
                            ]),
                            _: 1
                          }, 8, ["color"]),
                          _createVNode(_component_v_chip, {
                            size: "small",
                            variant: "tonal"
                          }, {
                            default: _withCtx(() => [
                              _createTextVNode("共 " + _toDisplayString(pathMapCheckResult.value.summary.total) + " 行", 1)
                            ]),
                            _: 1
                          }),
                          (pathMapCheckResult.value.summary.ok)
                            ? (_openBlock(), _createBlock(_component_v_chip, {
                                key: 0,
                                size: "small",
                                color: "success",
                                variant: "tonal"
                              }, {
                                default: _withCtx(() => [
                                  _createVNode(_component_v_icon, { left: "" }, {
                                    default: _withCtx(() => [...(_cache[34] || (_cache[34] = [
                                      _createTextVNode("mdi-check", -1)
                                    ]))]),
                                    _: 1
                                  }),
                                  _createTextVNode("OK " + _toDisplayString(pathMapCheckResult.value.summary.ok), 1)
                                ]),
                                _: 1
                              }))
                            : _createCommentVNode("", true),
                          (pathMapCheckResult.value.summary.bad_remote)
                            ? (_openBlock(), _createBlock(_component_v_chip, {
                                key: 1,
                                size: "small",
                                color: "warning",
                                variant: "tonal"
                              }, {
                                default: _withCtx(() => [
                                  _createTextVNode(" 远程缺失 " + _toDisplayString(pathMapCheckResult.value.summary.bad_remote), 1)
                                ]),
                                _: 1
                              }))
                            : _createCommentVNode("", true),
                          (pathMapCheckResult.value.summary.bad_local)
                            ? (_openBlock(), _createBlock(_component_v_chip, {
                                key: 2,
                                size: "small",
                                color: "warning",
                                variant: "tonal"
                              }, {
                                default: _withCtx(() => [
                                  _createTextVNode(" 本地缺失 " + _toDisplayString(pathMapCheckResult.value.summary.bad_local), 1)
                                ]),
                                _: 1
                              }))
                            : _createCommentVNode("", true),
                          (pathMapCheckResult.value.summary.bad_both)
                            ? (_openBlock(), _createBlock(_component_v_chip, {
                                key: 3,
                                size: "small",
                                color: "error",
                                variant: "tonal"
                              }, {
                                default: _withCtx(() => [
                                  _createTextVNode(" 两端均缺 " + _toDisplayString(pathMapCheckResult.value.summary.bad_both), 1)
                                ]),
                                _: 1
                              }))
                            : _createCommentVNode("", true),
                          (pathMapCheckResult.value.summary.bad_format)
                            ? (_openBlock(), _createBlock(_component_v_chip, {
                                key: 4,
                                size: "small",
                                color: "error",
                                variant: "tonal"
                              }, {
                                default: _withCtx(() => [
                                  _createTextVNode(" 格式错 " + _toDisplayString(pathMapCheckResult.value.summary.bad_format), 1)
                                ]),
                                _: 1
                              }))
                            : _createCommentVNode("", true),
                          _createVNode(_component_v_spacer),
                          _createElementVNode("small", _hoisted_22, "校验源: " + _toDisplayString(pathMapCheckResult.value.source), 1)
                        ]),
                        (pathMapCheckResult.value.lines && pathMapCheckResult.value.lines.length)
                          ? (_openBlock(), _createBlock(_component_v_data_table, {
                              key: 0,
                              headers: [
                { title: '#',         key: 'line_no', width: 50 },
                { title: '原始行',    key: 'raw' },
                { title: '远程前缀',  key: 'remote' },
                { title: '本地前缀',  key: 'local' },
                { title: '校验结果',  key: 'status', width: 130 },
              ],
                              items: pathMapCheckResult.value.lines,
                              "items-per-page": 50,
                              density: "compact",
                              class: "elevation-0 mt-2"
                            }, {
                              "item.line_no": _withCtx(({ item }) => [
                                _createElementVNode("span", _hoisted_23, _toDisplayString(item.line_no), 1)
                              ]),
                              "item.raw": _withCtx(({ item }) => [
                                _createElementVNode("code", _hoisted_24, _toDisplayString(item.raw), 1)
                              ]),
                              "item.remote": _withCtx(({ item }) => [
                                _createElementVNode("code", {
                                  class: _normalizeClass(["text-caption", { 'text-warning': !item.remote }])
                                }, _toDisplayString(item.remote || '—'), 3)
                              ]),
                              "item.local": _withCtx(({ item }) => [
                                _createElementVNode("code", {
                                  class: _normalizeClass(["text-caption", { 'text-warning': !item.local }])
                                }, _toDisplayString(item.local || '—'), 3)
                              ]),
                              "item.status": _withCtx(({ item }) => [
                                _createVNode(_component_v_tooltip, {
                                  text: item.msg || '',
                                  location: "top"
                                }, {
                                  activator: _withCtx(({ props: tip }) => [
                                    _createVNode(_component_v_chip, _mergeProps(tip, {
                                      size: "x-small",
                                      color: statusMeta(item.status).color,
                                      variant: "flat"
                                    }), {
                                      default: _withCtx(() => [
                                        _createVNode(_component_v_icon, {
                                          left: "",
                                          size: "x-small"
                                        }, {
                                          default: _withCtx(() => [
                                            _createTextVNode(_toDisplayString(statusMeta(item.status).icon), 1)
                                          ]),
                                          _: 2
                                        }, 1024),
                                        _createTextVNode(" " + _toDisplayString(statusMeta(item.status).label), 1)
                                      ]),
                                      _: 2
                                    }, 1040, ["color"])
                                  ]),
                                  _: 2
                                }, 1032, ["text"])
                              ]),
                              _: 1
                            }, 8, ["items"]))
                          : (_openBlock(), _createElementBlock("div", _hoisted_25, "没有可校验的行 (留空?)"))
                      ], 64))
                    : _createCommentVNode("", true)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          _createVNode(_component_v_alert, {
            type: "info",
            density: "compact",
            variant: "tonal",
            class: "mb-2"
          }, {
            default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
              _createTextVNode(" 仅对“扫描后不在任何做种种子内的文件”列为候选,删除需人工勾选确认;种子内文件绝不会被误判为可删除。 ", -1)
            ]))]),
            _: 1
          }),
          (ldata.value.warnings && ldata.value.warnings.length)
            ? (_openBlock(), _createBlock(_component_v_alert, {
                key: 0,
                type: "warning",
                density: "compact",
                variant: "tonal",
                class: "mb-2"
              }, {
                default: _withCtx(() => [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(ldata.value.warnings, (w, i) => {
                    return (_openBlock(), _createElementBlock("div", {
                      key: i,
                      class: "text-caption"
                    }, _toDisplayString(w), 1))
                  }), 128))
                ]),
                _: 1
              }))
            : _createCommentVNode("", true),
          _createElementVNode("div", _hoisted_26, [
            _createVNode(_component_v_checkbox, {
              label: "全选",
              "hide-details": "",
              density: "compact",
              indeterminate: selected.value.length > 0 && selected.value.length < removables.value.length,
              "model-value": removables.value.length > 0 && selected.value.length === removables.value.length,
              "onUpdate:modelValue": toggleAll
            }, null, 8, ["indeterminate", "model-value"]),
            _createElementVNode("small", _hoisted_27, "已选 " + _toDisplayString(selected.value.length) + " 项 / " + _toDisplayString(_unref(formatSize)(selectedSize())), 1),
            _createVNode(_component_v_spacer),
            _createVNode(_component_v_btn, {
              density: "compact",
              color: "error",
              variant: "tonal",
              size: "small",
              disabled: !selected.value.length,
              onClick: deleteSelected
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, { left: "" }, {
                  default: _withCtx(() => [...(_cache[36] || (_cache[36] = [
                    _createTextVNode("mdi-trash-can", -1)
                  ]))]),
                  _: 1
                }),
                _cache[37] || (_cache[37] = _createTextVNode("删除所选 ", -1))
              ]),
              _: 1
            }, 8, ["disabled"]),
            _createVNode(_component_v_btn, {
              density: "compact",
              color: "error",
              variant: "text",
              size: "small",
              disabled: !removables.value.length,
              onClick: _cache[5] || (_cache[5] = $event => {selected.value = removables.value.map(x => x.rel); deleteSelected();})
            }, {
              default: _withCtx(() => [...(_cache[38] || (_cache[38] = [
                _createTextVNode(" 清空所有候选 ", -1)
              ]))]),
              _: 1
            }, 8, ["disabled"]),
            _createVNode(_component_v_btn, {
              density: "compact",
              color: "orange-darken-1",
              variant: "tonal",
              size: "small",
              disabled: !emptyDirs.value.length,
              onClick: cleanEmptyDirs
            }, {
              default: _withCtx(() => [
                _createVNode(_component_v_icon, { left: "" }, {
                  default: _withCtx(() => [...(_cache[39] || (_cache[39] = [
                    _createTextVNode("mdi-folder-remove", -1)
                  ]))]),
                  _: 1
                }),
                _createTextVNode("清空目录(" + _toDisplayString(_unref(fmtInt)(emptyDirs.value.length)) + ") ", 1)
              ]),
              _: 1
            }, 8, ["disabled"])
          ]),
          _createVNode(_component_v_card, { variant: "outlined" }, {
            default: _withCtx(() => [
              _createVNode(_component_v_data_table, {
                modelValue: selected.value,
                "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((selected).value = $event)),
                "show-select": "",
                "item-value": "rel",
                headers: [
            { title: '相对路径', key: 'rel' },
            { title: '大小', key: 'size', align: 'end' },
          ],
                items: removables.value,
                "items-per-page": 50,
                density: "compact",
                class: "elevation-0"
              }, {
                "item.rel": _withCtx(({ item }) => [
                  _createTextVNode(_toDisplayString(item.rel), 1)
                ]),
                "item.size": _withCtx(({ item }) => [
                  _createTextVNode(_toDisplayString(_unref(formatSize)(item.size)), 1)
                ]),
                _: 1
              }, 8, ["modelValue", "items"]),
              (!removables.value.length)
                ? (_openBlock(), _createBlock(_component_v_card_text, {
                    key: 0,
                    class: "text-center text-grey text-body-2"
                  }, {
                    default: _withCtx(() => [
                      _createTextVNode(_toDisplayString(localEmpty.value ? '从未扫描。请点击上方「本地扫描」生成候选清单。' : '本次扫描未发现冗余文件,磁盘与做种种子一致。'), 1)
                    ]),
                    _: 1
                  }))
                : _createCommentVNode("", true)
            ]),
            _: 1
          })
        ]))
  ]))
}
}

};
const AppPage = /*#__PURE__*/_export_sfc(_sfc_main, [['__scopeId',"data-v-b938605d"]]);

export { AppPage as default };
