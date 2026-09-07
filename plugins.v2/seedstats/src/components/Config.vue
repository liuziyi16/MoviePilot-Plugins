<template>
  <div class="plugin-config">
    <v-alert v-if="error" type="error" class="mb-4" variant="tonal">{{ error }}</v-alert>

    <div class="text-subtitle-1 font-weight-bold mt-2 mb-2">基本设置</div>
    <v-row dense>
      <v-col cols="12" md="4">
        <v-switch v-model="config.enabled" label="启用插件" color="primary" inset hide-details></v-switch>
      </v-col>
      <v-col cols="12" md="4">
        <v-switch v-model="config.local_scan" label="启用每日本地对比" color="primary" inset
          hint="定时对比磁盘,生成可删候选清单(不会自动删)" persistent-hint></v-switch>
      </v-col>
      <v-col cols="12" md="4">
        <v-switch v-model="config.notify" label="扫描完成通知" color="primary" inset
          hint="统计/对比完成后的推送提醒" persistent-hint></v-switch>
      </v-col>
    </v-row>

    <div class="text-subtitle-1 font-weight-bold mt-4 mb-2">调度周期 (5段cron, 宿主时区)</div>
    <v-row dense>
      <v-col cols="12" md="6">
        <v-text-field v-model="config.seed_cron" label="种子统计 cron" placeholder="0 */12 * * *"
          hint="留空回退默认(每12小时)" persistent-hint variant="outlined" clearable></v-text-field>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="config.local_cron" label="本地对比 cron" placeholder="20 3 * * *"
          hint="仅启用本地对比时生效, 默认每天 03:20" persistent-hint variant="outlined" clearable></v-text-field>
      </v-col>
    </v-row>

    <div class="text-subtitle-1 font-weight-bold mt-4 mb-2">下载器与站点</div>
    <v-row dense>
      <v-col cols="12">
        <v-select v-model="config.downloaders" :items="downloaderOptions" item-title="title" item-value="value"
          label="参与统计的下载器" multiple chips closable-chips variant="outlined"
          hint="留空 = 统计所有已启用下载器" persistent-hint :loading="loadingDownloaders"></v-select>
      </v-col>
      <v-col cols="12" md="6">
        <v-textarea v-model="config.site_suffixes" label="站点官方后缀(判定官组)" rows="3" variant="outlined"
          hint="每行一项, 格式: 站点名:后缀1,后缀2" persistent-hint></v-textarea>
      </v-col>
      <v-col cols="12" md="6">
        <v-textarea v-model="config.site_domains" label="站点域名补充" rows="3" variant="outlined"
          hint="每行一项, 格式: 站点名:域名1,域名2" persistent-hint></v-textarea>
      </v-col>
    </v-row>

    <div class="text-subtitle-1 font-weight-bold mt-4 mb-2">本地对比路径</div>
    <v-row dense>
      <v-col cols="12" md="6">
        <v-textarea v-model="config.path_map" label="磁盘路径映射(远程→本地)" rows="3" variant="outlined"
          hint="每行一项, 格式: 远程前缀=本地根目录。启用本地对比且路径不一致时必填" persistent-hint></v-textarea>
      </v-col>
      <v-col cols="12" md="6">
        <v-textarea v-model="config.exclude_paths" label="本地对比排除路径" rows="3" variant="outlined"
          hint="每行一项, 命中的绝对前缀将被跳过" persistent-hint></v-textarea>
      </v-col>
    </v-row>

    <div class="d-flex justify-end mt-2">
      <v-btn class="me-2" variant="text" prepend-icon="mdi-chart-donut" @click="emit('switch')">查看统计</v-btn>
      <v-btn class="me-2" variant="text" @click="emit('close')">取消</v-btn>
      <v-btn color="primary" :loading="saving" @click="saveConfig">保存</v-btn>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// MP 设置弹框传入: initial-config(当前配置) + api(主应用api客户端)
const props = defineProps({
  initialConfig: { type: Object, default: () => ({}) },
  api: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'switch', 'save'])

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
}

const config = reactive({ ...DEFAULTS })
const saving = ref(false)
const error = ref(null)
const snackbar = reactive({ show: false, text: '', color: 'success' })
const downloaderOptions = ref([])
const loadingDownloaders = ref(false)

onMounted(async () => {
  if (props.initialConfig && typeof props.initialConfig === 'object') {
    Object.keys(DEFAULTS).forEach(key => {
      const v = props.initialConfig[key]
      if (v !== undefined && v !== null) config[key] = v
    })
  }
  await loadDownloaders()
})

async function loadDownloaders() {
  try {
    loadingDownloaders.value = true
    const res = await props.api.get('plugin/core/services?type=downloader')
    const list = Array.isArray(res) ? res : (res?.data ?? [])
    downloaderOptions.value = list.map(x => ({
      title: x.name || x.title || x.id || String(x),
      value: x.id || x.value || x.name || String(x),
    }))
  } catch (e) {
    console.error('获取下载器列表失败:', e)
  } finally {
    loadingDownloaders.value = false
  }
}

async function saveConfig() {
  saving.value = true
  error.value = null
  try {
    await props.api.put('plugin/SeedStats', { ...config })
    snackbar.text = '配置已保存'
    snackbar.color = 'success'
    snackbar.show = true
    emit('save', { ...config })
  } catch (e) {
    console.error('保存配置失败:', e)
    error.value = e?.message || '保存配置失败'
    snackbar.text = error.value
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    saving.value = false
  }
}
</script>
