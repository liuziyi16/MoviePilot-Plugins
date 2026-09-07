import { importShared } from './__federation_fn_import-JrT3xvdd.js';

const {toDisplayString:_toDisplayString,createTextVNode:_createTextVNode,resolveComponent:_resolveComponent,withCtx:_withCtx,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,createElementVNode:_createElementVNode,createVNode:_createVNode,createElementBlock:_createElementBlock} = await importShared('vue');


const _hoisted_1 = { class: "plugin-config" };
const _hoisted_2 = { class: "d-flex justify-end mt-2" };

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

onMounted(async () => {
  if (props.initialConfig && typeof props.initialConfig === 'object') {
    Object.keys(DEFAULTS).forEach(key => {
      const v = props.initialConfig[key];
      if (v !== undefined && v !== null) config[key] = v;
    });
  }
  await loadDownloaders();
});

async function loadDownloaders() {
  try {
    loadingDownloaders.value = true;
    const res = await props.api.get('plugin/core/services?type=downloader');
    const list = Array.isArray(res) ? res : (res?.data ?? []);
    downloaderOptions.value = list.map(x => ({
      title: x.name || x.title || x.id || String(x),
      value: x.id || x.value || x.name || String(x),
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
  const _component_v_alert = _resolveComponent("v-alert");
  const _component_v_switch = _resolveComponent("v-switch");
  const _component_v_col = _resolveComponent("v-col");
  const _component_v_row = _resolveComponent("v-row");
  const _component_v_text_field = _resolveComponent("v-text-field");
  const _component_v_select = _resolveComponent("v-select");
  const _component_v_textarea = _resolveComponent("v-textarea");
  const _component_v_btn = _resolveComponent("v-btn");
  const _component_v_snackbar = _resolveComponent("v-snackbar");

  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
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
    _cache[16] || (_cache[16] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-2 mb-2" }, "基本设置", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, {
          cols: "12",
          md: "4"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_switch, {
              modelValue: config.enabled,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => ((config.enabled) = $event)),
              label: "启用插件",
              color: "primary",
              inset: "",
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
              "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => ((config.local_scan) = $event)),
              label: "启用每日本地对比",
              color: "primary",
              inset: "",
              hint: "定时对比磁盘,生成可删候选清单(不会自动删)",
              "persistent-hint": ""
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
              "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => ((config.notify) = $event)),
              label: "扫描完成通知",
              color: "primary",
              inset: "",
              hint: "统计/对比完成后的推送提醒",
              "persistent-hint": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _cache[17] || (_cache[17] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-4 mb-2" }, "调度周期 (5段cron, 宿主时区)", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_text_field, {
              modelValue: config.seed_cron,
              "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => ((config.seed_cron) = $event)),
              label: "种子统计 cron",
              placeholder: "0 */12 * * *",
              hint: "留空回退默认(每12小时)",
              "persistent-hint": "",
              variant: "outlined",
              clearable: ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        }),
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_text_field, {
              modelValue: config.local_cron,
              "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => ((config.local_cron) = $event)),
              label: "本地对比 cron",
              placeholder: "20 3 * * *",
              hint: "仅启用本地对比时生效, 默认每天 03:20",
              "persistent-hint": "",
              variant: "outlined",
              clearable: ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _cache[18] || (_cache[18] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-4 mb-2" }, "下载器与站点", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, { cols: "12" }, {
          default: _withCtx(() => [
            _createVNode(_component_v_select, {
              modelValue: config.downloaders,
              "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => ((config.downloaders) = $event)),
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
            _createVNode(_component_v_textarea, {
              modelValue: config.site_suffixes,
              "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => ((config.site_suffixes) = $event)),
              label: "站点官方后缀(判定官组)",
              rows: "3",
              variant: "outlined",
              hint: "每行一项, 格式: 站点名:后缀1,后缀2",
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
              modelValue: config.site_domains,
              "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => ((config.site_domains) = $event)),
              label: "站点域名补充",
              rows: "3",
              variant: "outlined",
              hint: "每行一项, 格式: 站点名:域名1,域名2",
              "persistent-hint": ""
            }, null, 8, ["modelValue"])
          ]),
          _: 1
        })
      ]),
      _: 1
    }),
    _cache[19] || (_cache[19] = _createElementVNode("div", { class: "text-subtitle-1 font-weight-bold mt-4 mb-2" }, "本地对比路径", -1)),
    _createVNode(_component_v_row, { dense: "" }, {
      default: _withCtx(() => [
        _createVNode(_component_v_col, {
          cols: "12",
          md: "6"
        }, {
          default: _withCtx(() => [
            _createVNode(_component_v_textarea, {
              modelValue: config.path_map,
              "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => ((config.path_map) = $event)),
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
              "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => ((config.exclude_paths) = $event)),
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
    _createElementVNode("div", _hoisted_2, [
      _createVNode(_component_v_btn, {
        class: "me-2",
        variant: "text",
        "prepend-icon": "mdi-chart-donut",
        onClick: _cache[10] || (_cache[10] = $event => (emit('switch')))
      }, {
        default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
          _createTextVNode("查看统计", -1)
        ]))]),
        _: 1
      }),
      _createVNode(_component_v_btn, {
        class: "me-2",
        variant: "text",
        onClick: _cache[11] || (_cache[11] = $event => (emit('close')))
      }, {
        default: _withCtx(() => [...(_cache[14] || (_cache[14] = [
          _createTextVNode("取消", -1)
        ]))]),
        _: 1
      }),
      _createVNode(_component_v_btn, {
        color: "primary",
        loading: saving.value,
        onClick: saveConfig
      }, {
        default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
          _createTextVNode("保存", -1)
        ]))]),
        _: 1
      }, 8, ["loading"])
    ]),
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
    }, 8, ["modelValue", "color"])
  ]))
}
}

};

export { _sfc_main as default };
