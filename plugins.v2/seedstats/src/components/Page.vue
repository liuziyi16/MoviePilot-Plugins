<template>
  <div style="padding: 8px">
    <AppPage
      :api="api"
      plugin-id="SeedStats"
      hide-title
      @close="$emit('close')"
      @switch="$emit('switch')"
    />
  </div>
</template>

<script setup>
// MP 数据弹框传入: api(主应用api客户端)
// @close / @switch 由 AppPage 在顶部工具条触发,透传给外层弹框容器
import AppPage from './AppPage.vue'

const props = defineProps({
  api: { type: Object, default: () => ({}) },
})
defineEmits(['close', 'switch'])
</script>
