<template>
  <div class="plugin-config" style="padding: 16px">
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
        <v-cron-field v-model="config.seed_cron" label="种子统计 cron" placeholder="0 */12 * * *"
          hint="留空回退默认(每12小时)" persistent-hint variant="outlined"></v-cron-field>
      </v-col>
      <v-col cols="12" md="6">
        <v-cron-field v-model="config.local_cron" label="本地对比 cron" placeholder="20 3 * * *"
          hint="仅启用本地对比时生效, 默认每天 03:20" persistent-hint variant="outlined"></v-cron-field>
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
        <div class="d-flex align-center mb-1">
          <span class="text-subtitle-2">站点官方后缀 (判定官组)</span>
          <v-spacer />
          <v-btn size="x-small" color="primary" variant="tonal" prepend-icon="mdi-plus"
            @click="openRuleDlg('suffix')">新增</v-btn>
        </div>
        <v-sheet variant="outlined" rounded style="min-height: 84px; max-height: 170px; overflow-y: auto;">
          <v-table v-if="suffixRules.length" density="compact">
            <tbody>
              <tr v-for="(r, i) in suffixRules" :key="'sf' + i">
                <td class="text-body-2">{{ r.site }}</td>
                <td class="text-body-2 text-medium-emphasis">{{ r.value }}</td>
                <td class="text-right" style="width: 44px;">
                  <v-btn icon size="x-small" variant="text" color="error" @click="suffixRules.splice(i, 1)">
                    <v-icon size="small">mdi-delete-outline</v-icon>
                    <v-tooltip activator="parent" location="top">删除</v-tooltip>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="text-body-2 text-medium-emphasis pa-3">
            暂无规则, 点击"新增"添加(站点: 后缀)
          </div>
        </v-sheet>
        <div class="text-caption text-medium-emphasis mt-1">命中后缀的做种种子判定为官组</div>
      </v-col>
      <v-col cols="12" md="6">
        <div class="d-flex align-center mb-1">
          <span class="text-subtitle-2">站点域名补充</span>
          <v-spacer />
          <v-btn size="x-small" color="primary" variant="tonal" prepend-icon="mdi-plus"
            @click="openRuleDlg('domain')">新增</v-btn>
        </div>
        <v-sheet variant="outlined" rounded style="min-height: 84px; max-height: 170px; overflow-y: auto;">
          <v-table v-if="domainRules.length" density="compact">
            <tbody>
              <tr v-for="(r, i) in domainRules" :key="'dm' + i">
                <td class="text-body-2">{{ r.site }}</td>
                <td class="text-body-2 text-medium-emphasis">{{ r.value }}</td>
                <td class="text-right" style="width: 44px;">
                  <v-btn icon size="x-small" variant="text" color="error" @click="domainRules.splice(i, 1)">
                    <v-icon size="small">mdi-delete-outline</v-icon>
                    <v-tooltip activator="parent" location="top">删除</v-tooltip>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="text-body-2 text-medium-emphasis pa-3">
            暂无规则, 点击"新增"添加(站点: 域名)
          </div>
        </v-sheet>
        <div class="text-caption text-medium-emphasis mt-1">系统已收录站点按 tracker 域名自动识别, 此处补充别名域名</div>
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

    <v-dialog v-model="ruleDlg.show" max-width="430">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">
          {{ ruleDlg.type === 'suffix' ? '新增官组后缀' : '新增站点域名' }}
        </v-card-title>
        <v-card-text>
          <v-combobox v-model="ruleDlg.site" :items="siteOptions" :loading="loadingSites" label="站点名称"
            variant="outlined" hint="可从站点库下拉选择, 也可手动输入别名" persistent-hint />
          <v-text-field v-model="ruleDlg.value" class="mt-3" variant="outlined"
            :label="ruleDlg.type === 'suffix' ? '官组后缀(不区分大小写)' : '补充域名(可多个, 逗号分隔)'"
            :placeholder="ruleDlg.type === 'suffix' ? '如 CHD' : '如 pt.example.net'" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="ruleDlg.show = false">取消</v-btn>
          <v-btn color="primary" :disabled="!ruleDlg.site || !ruleDlg.value" @click="confirmRule">确定</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
// 站点规则(结构化编辑, 保存时序列化回字符串): [{site, value}]
const suffixRules = ref([])
const domainRules = ref([])
const siteOptions = ref([])
const loadingSites = ref(false)
const ruleDlg = reactive({ show: false, type: 'suffix', site: '', value: '' })

// '站点名:值1,值2' 多行文本 -> [{site, value}]（兼容中文逗号与竖线分隔）
function parseRules(str) {
  const out = []
  String(str || '').split(/\n+/).forEach(line => {
    const s = line.trim()
    if (!s || !s.includes(':')) return
    const idx = s.indexOf(':')
    const site = s.slice(0, idx).trim()
    if (!site) return
    s.slice(idx + 1).split(/[,，|]+/).forEach(v => {
      v = v.trim()
      if (v) out.push({ site, value: v })
    })
  })
  return out
}

// [{site, value}] -> '站点名:值1,值2' 多行文本（同站点自动合并）
function serializeRules(rules) {
  const map = {}
  rules.forEach(r => {
    const site = String(r.site || '').trim()
    const val = String(r.value || '').trim()
    if (site && val) (map[site] = map[site] || []).push(val)
  })
  return Object.entries(map).map(([site, vals]) => `${site}:${vals.join(',')}`).join('\n')
}

// 站点库下拉选项(与 MP 站点名一致, 避免手输偏差)
async function loadSites() {
  try {
    loadingSites.value = true
    const res = await props.api.get('site/')
    const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])
    siteOptions.value = list.map(x => x?.name).filter(Boolean)
  } catch (e) {
    console.error('获取站点列表失败:', e)
  } finally {
    loadingSites.value = false
  }
}

function openRuleDlg(type) {
  ruleDlg.type = type
  ruleDlg.site = ''
  ruleDlg.value = ''
  ruleDlg.show = true
}

function confirmRule() {
  const site = String(ruleDlg.site || '').trim()
  if (!site) return
  const target = ruleDlg.type === 'suffix' ? suffixRules : domainRules
  String(ruleDlg.value || '').split(/[,，]+/).forEach(v => {
    v = v.trim()
    if (v) target.value.push({ site, value: v })
  })
  ruleDlg.show = false
}

onMounted(async () => {
  if (props.initialConfig && typeof props.initialConfig === 'object') {
    Object.keys(DEFAULTS).forEach(key => {
      const v = props.initialConfig[key]
      if (v !== undefined && v !== null) config[key] = v
    })
  }
  suffixRules.value = parseRules(config.site_suffixes)
  domainRules.value = parseRules(config.site_domains)
  await Promise.all([loadDownloaders(), loadSites()])
})

async function loadDownloaders() {
  try {
    loadingDownloaders.value = true
    // MP v2 下载器配置存于 system/setting/Downloaders: {success, data: {value: [{name, type, enabled}]}}
    const res = await props.api.get('system/setting/Downloaders')
    const raw = Array.isArray(res)
      ? res
      : (Array.isArray(res?.data?.value) ? res.data.value : (Array.isArray(res?.data) ? res.data : []))
    downloaderOptions.value = raw
      .filter(x => x && x.enabled !== false)
      .map(x => ({
        title: x.name || x.title || x.type || String(x),
        value: x.name || x.value || x.id || String(x),
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
    config.site_suffixes = serializeRules(suffixRules.value)
    config.site_domains = serializeRules(domainRules.value)
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
