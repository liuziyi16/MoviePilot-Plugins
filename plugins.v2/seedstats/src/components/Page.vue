<template>
  <div style="padding: 8px">
    <AppPage :api="api" plugin-id="SeedStats" hide-title />
  </div>
</template>

<script setup>
// MP 数据弹框传入: api(主应用api客户端)
// 直接复用侧栏整页组件 AppPage, 隐藏标题
import AppPage from './AppPage.vue'

const props = defineProps({
  api: { type: Object, default: () => ({}) },
})
</script>
