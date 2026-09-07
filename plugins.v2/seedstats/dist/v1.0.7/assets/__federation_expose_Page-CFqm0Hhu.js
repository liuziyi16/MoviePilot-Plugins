import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import AppPage from './__federation_expose_AppPage-BghMlatS.js';

const {createVNode:_createVNode,openBlock:_openBlock,createElementBlock:_createElementBlock} = await importShared('vue');


const _hoisted_1 = { style: {"padding":"8px"} };


const _sfc_main = {
  __name: 'Page',
  props: {
  api: { type: Object, default: () => ({}) },
},
  setup(__props) {

return (_ctx, _cache) => {
  return (_openBlock(), _createElementBlock("div", _hoisted_1, [
    _createVNode(AppPage, {
      api: __props.api,
      "plugin-id": "SeedStats",
      "hide-title": ""
    }, null, 8, ["api"])
  ]))
}
}

};

export { _sfc_main as default };
