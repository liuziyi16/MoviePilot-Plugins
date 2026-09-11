<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { unwrapResponse, dataOf, formatSize, fmtInt, fmtRatio } from '../provider'

const props = defineProps({
  api: { type: Object, default: () => ({}) },
  pluginId: { type: String, default: 'SeedStats' },
  hideTitle: { type: Boolean, default: false },
})

const pluginBase = computed(() => `plugin/${props.pluginId || 'SeedStats'}`)

// ---------- 视图模式(单页双 Tab:统计 / 本地) ----------
const mode = ref('seed')

// ---------- 种子统计 ----------
const seedLoading = ref(false)
const seed = ref(null)
const seedEmpty = ref(true)

const stats = computed(() => seed.value || {})
const overall = computed(() => stats.value.overall || {})
const siteRows = computed(() => stats.value.sites || [])
const groupRows = computed(() => stats.value.official_groups || [])
const unmatchedGroups = computed(() => stats.value.unmatched_groups || [])
const stateRows = computed(() => stats.value.states || [])
const unidentified = computed(() => stats.value.unidentified || [])

// ---------- 本地清理 ----------
const localLoading = ref(false)
const local = ref(null)
const localEmpty = ref(true)
const selected = ref([]) // 选中的 removable.rel

const ldata = computed(() => local.value || {})
const removables = computed(() => ldata.value.removable || [])
const emptyDirs = computed(() => ldata.value.empty_dirs || [])

// ---------- 通用 ----------
const toast = ref('')
const errorMsg = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2600)
}
function notify(msg, kind = 'info') {
  showToast(msg)
}

// 简化通知:官方主应用会把 toast/snack 注入 props;这里做兜底
const emit = defineEmits(['message', 'close', 'switch'])
function toastMsg(text, color) {
  toast.value = text
  emit('message', { text, color: color || 'info' })
  setTimeout(() => (toast.value = ''), 3000)
}

// ---------- 路径映射校验(本地清理 Tab) ----------
// 把当前表单里的 path_map 文本粘贴到这里做存在校验;
// 也可留空,后端会读 self._path_map(已保存到插件配置项的最新值)
const pathMapInput = ref('')
const pathMapCheckLoading = ref(false)
const pathMapCheckResult = ref(null)   // 后端返回的 { ok, summary, lines, source }
const pathMapCheckError = ref('')

// 状态 -> 颜色 + 图标。集中放便于前端一致渲染
const STATUS_META = {
  ok:          { color: 'success', icon: 'mdi-check-circle',     label: 'OK' },
  bad_remote:  { color: 'warning', icon: 'mdi-cloud-alert',     label: '远程缺失' },
  bad_local:   { color: 'warning', icon: 'mdi-folder-alert',    label: '本地缺失' },
  bad_both:    { color: 'error',   icon: 'mdi-close-circle',    label: '两端均缺' },
  bad_format:  { color: 'error',   icon: 'mdi-alert-circle',    label: '格式错' },
}
function statusMeta(s) { return STATUS_META[s] || STATUS_META.bad_format }

async function checkPathMap() {
  pathMapCheckLoading.value = true
  pathMapCheckError.value = ''
  try {
    const body = { raw: pathMapInput.value || '' }
    const r = await props.api.post(`${pluginBase.value}/validate_path_map`, body)
    const d = unwrapResponse(r)
    // 兼容后端返回 { ok, summary, lines, source } 也兼容顶层包 data
    const payload = d && d.data ? d.data : d
    pathMapCheckResult.value = payload || null
    if (!payload) {
      pathMapCheckError.value = '后端未返回数据'
    }
  } catch (e) {
    pathMapCheckError.value = e?.message || '校验失败'
    pathMapCheckResult.value = null
  } finally {
    pathMapCheckLoading.value = false
  }
}

// ================= 数据加载 =================
async function loadSeed() {
  seedLoading.value = true
  errorMsg.value = ''
  try {
    const r = await props.api.get(`${pluginBase.value}/data`)
    const d = unwrapResponse(r)
    if (d && d.empty) {
      seed.value = null
      seedEmpty.value = true
    } else {
      seed.value = d.data || d
      seedEmpty.value = false
    }
  } catch (e) {
    errorMsg.value = e?.message || '加载统计失败'
  } finally {
    seedLoading.value = false
  }
}

async function loadLocal() {
  localLoading.value = true
  errorMsg.value = ''
  try {
    const r = await props.api.get(`${pluginBase.value}/local`)
    const d = unwrapResponse(r)
    local.value = d.data || d
    localEmpty.value = !(local.value && local.value.removable_count >= 0)
  } catch (e) {
    errorMsg.value = e?.message || '加载本地结果失败'
  } finally {
    localLoading.value = false
  }
}

// ================= 触发扫描 =================
async function triggerScan(which) {
  const body = which === 'local' ? { local: true } : {}
  try {
    const r = await props.api.post(`${pluginBase.value}/scan`, body)
    const d = unwrapResponse(r)
    if (d && d.ok === false) {
      toastMsg(d.err || '已有扫描进行中', 'error')
      return false
    }
    // 扫描后台进行,轮询等待结果
    pollForever()
    return true
  } catch (e) {
    toastMsg(e?.message || '触发扫描失败', 'error')
    return false
  }
}

// ---------- 轮询:触发扫描后定时刷新对应数据直到 updated_at 变化 ----------
let pollTimer = null
const requestOf = {
  seed: loadSeed,
  local: loadLocal,
}

// 在 scan POST 成功后持续刷新直到数据时间戳推进(扫描完成)。
function pollForever(interval = 2500, max = 40) {
  stopPoll()
  const modeNow = mode.value
  // 保留开始时间戳便于判断
  pollTimer = setInterval(async () => {
    try {
      const before = modeNow === 'local' ? ldata.value.updated_at : stats.value.updated_at
      await requestOf[modeNow]?.()
      const after = modeNow === 'local' ? ldata.value.updated_at : stats.value.updated_at
      if (after && before && after !== before) {
        stopPoll()
        toastMsg('扫描完成', 'success')
      }
    } catch (e) {
      stopPoll()
    }
    max -= 1
    if (max <= 0) stopPoll()
  }, interval)
}
function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ================= 本地清理操作 =================
function toggleAll(ev) {
  selected.value = ev ? removables.value.map(x => x.rel) : []
}

function selectedSize() {
  return removables.value
    .filter(x => selected.value.includes(x.rel))
    .reduce((s, x) => s + Number(x.size || 0), 0)
}

async function deleteSelected() {
  const rels = selected.value
  if (!rels.length) return
  try {
    const r = await props.api.post(`${pluginBase.value}/delete`, { paths: rels })
    const d = unwrapResponse(r)
    const res = d.result || {}
    const done = (res.deleted || []).length
    const rej = (res.rejected || []).length
    const fail = (res.failed || []).length
    selected.value = []
    toastMsg(`删除完成:成功 ${done},拒绝 ${rej},失败 ${fail}`, rej || fail ? 'warning' : 'success')
    // 删除后后台已重扫,轮询刷新
    setTimeout(loadLocal, 1200)
  } catch (e) {
    toastMsg(e?.message || '删除失败', 'error')
  }
}

async function cleanEmptyDirs() {
  try {
    const r = await props.api.post(`${pluginBase.value}/clean_empty`, {})
    const d = unwrapResponse(r)
    const removed = (d.removed || []).length
    toastMsg(`空目录已清理 ${removed} 个`, removed ? 'success' : 'info')
    setTimeout(loadLocal, 800)
  } catch (e) {
    toastMsg(e?.message || '清理失败', 'error')
  }
}

// ================= 生命周期 =================
onMounted(() => {
  loadSeed()
})
onBeforeUnmount(stopPoll)

defineExpose({ loadSeed, loadLocal })
</script>

<template>
  <div class="ss-root pa-2" style="max-width: 1180px">
    <!-- 顶部工具条 -->
    <div class="d-flex align-center mb-2 flex-wrap ga-2">
      <v-btn-toggle v-model="mode" density="compact" mandatory rounded="lg">
        <v-btn value="seed" size="small"><v-icon left>mdi-radar</v-icon>做种统计</v-btn>
        <v-btn value="local" size="small"><v-icon left>mdi-folder-search</v-icon>本地清理</v-btn>
      </v-btn-toggle>
      <v-spacer />
      <template v-if="mode === 'seed'">
        <v-chip density="compact" :color="seedLoading ? 'grey' : 'primary'">
          {{ seedLoading ? '加载中…' : (stats.updated_at || '尚未扫描') }}
        </v-chip>
        <v-btn density="compact" color="primary" variant="flat" size="small"
          :loading="seedLoading" @click="loadSeed()">
          <v-icon left>mdi-refresh</v-icon>刷新
        </v-btn>
        <v-btn density="compact" color="info" variant="tonal" size="small"
          @click="triggerScan('seed').then(() => toastMsg('已开始后台统计…', 'info'))">
          <v-icon left>mdi-play</v-icon>扫描
        </v-btn>
        <template v-if="hideTitle">
          <v-btn density="compact" variant="tonal" size="small"
            prepend-icon="mdi-cog" @click="emit('switch')">回到设置</v-btn>
          <v-btn density="compact" variant="text" size="small"
            prepend-icon="mdi-close" @click="emit('close')">关闭</v-btn>
        </template>
      </template>
      <template v-else>
        <v-chip density="compact" :color="localLoading ? 'grey' : 'primary'">
          {{ localLoading ? '加载中…' : (ldata.updated_at || '尚未扫描') }}
        </v-chip>
        <v-btn density="compact" color="info" variant="tonal" size="small"
          @click="triggerScan('local')">
          <v-icon left>mdi-play</v-icon>本地扫描
        </v-btn>
        <template v-if="hideTitle">
          <v-btn density="compact" variant="tonal" size="small"
            prepend-icon="mdi-cog" @click="emit('switch')">回到设置</v-btn>
          <v-btn density="compact" variant="text" size="small"
            prepend-icon="mdi-close" @click="emit('close')">关闭</v-btn>
        </template>
      </template>
    </div>

    <!-- 顶部提示条 -->
    <v-alert v-if="toast" density="compact" type="success" variant="tonal" class="mb-2">{{ toast }}</v-alert>
    <v-alert v-if="errorMsg" density="compact" type="error" variant="tonal" class="mb-2">{{ errorMsg }}</v-alert>

    <v-progress-linear v-if="seedLoading || localLoading" indeterminate color="primary" class="mb-2" />

    <!-- ======================= 做种统计 ======================= -->
    <div v-if="mode === 'seed'">
      <v-row class="mb-2">
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">做种任务</div>
              <div class="text-h6">{{ fmtInt(overall.count) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">总量</div>
              <div class="text-h6">{{ formatSize(overall.size) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">做种中</div>
              <div class="text-h6">{{ fmtInt(overall.seeding_count) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">暂停</div>
              <div class="text-h6">{{ fmtInt(overall.paused_count) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">做种体积</div>
              <div class="text-h6">{{ formatSize(overall.seeding_size) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">平均分享率</div>
              <div class="text-h6">{{ fmtRatio(overall.avg_ratio) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 站点分布 -->
      <v-card class="mb-2" variant="outlined">
        <v-card-title class="text-subtitle-1 py-2">站点分布</v-card-title>
        <v-data-table
          :headers="[
            { title: '站点', key: 'site' },
            { title: '种子数', key: 'count' },
            { title: '体积', key: 'size' },
            { title: '做种中', key: 'seeding_count' },
            { title: '暂停', key: 'paused_count' },
            { title: '官组', key: 'official' },
          ]"
          :items="siteRows"
          :items-per-page="-1"
          density="compact"
          class="elevation-0"
        >
          <template #item.site="{ item }">
            <b>{{ item.site }}</b>
          </template>
          <template #item.count="{ item }">{{ fmtInt(item.count) }}</template>
          <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
          <template #item.seeding_count="{ item }">{{ fmtInt(item.seeding_count) }}</template>
          <template #item.paused_count="{ item }">
            <span :class="Number(item.paused_count) > 0 ? 'text-warning' : 'text-grey'">
              {{ fmtInt(item.paused_count) }}
            </span>
          </template>
          <template #item.official="{ item }">
            <v-chip size="x-small" color="purple" v-if="Number(item.official) > 0">
              {{ item.official }}
            </v-chip>
            <span v-else>—</span>
          </template>
        </v-data-table>
      </v-card>

      <!-- 官方组(仅当存在时) -->
      <v-card v-if="groupRows.length" class="mb-2" variant="outlined">
        <v-card-title class="text-subtitle-1 py-2">
          官方官组做种 <v-chip size="small" color="purple">{{ groupRows.length }} 站</v-chip>
        </v-card-title>
        <v-data-table
          :headers="[
            { title: '站点', key: 'site' },
            { title: '官组数', key: 'count' },
            { title: '体积', key: 'size' },
            { title: '做种中', key: 'seeding_count' },
            { title: '暂停', key: 'paused_count' },
          ]"
          :items="groupRows"
          :items-per-page="-1"
          density="compact"
        >
          <template #item.count="{ item }">{{ fmtInt(item.count) }}</template>
          <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
          <template #item.seeding_count="{ item }">{{ fmtInt(item.seeding_count) }}</template>
          <template #item.paused_count="{ item }">{{ fmtInt(item.paused_count) }}</template>
        </v-data-table>
      </v-card>

      <!-- 非官组种子(仅当存在时) -->
      <v-card v-if="unmatchedGroups.length" class="mb-2" variant="outlined">
        <v-card-title class="text-subtitle-1 py-2">
          非官组种子 <v-chip size="small" color="grey">{{ unmatchedGroups.length }} 站</v-chip>
        </v-card-title>
        <v-data-table
          :headers="[
            { title: '站点', key: 'site' },
            { title: '种子数', key: 'count' },
            { title: '体积', key: 'size' },
            { title: '做种中', key: 'seeding_count' },
            { title: '暂停', key: 'paused_count' },
          ]"
          :items="unmatchedGroups"
          :items-per-page="-1"
          density="compact"
        >
          <template #item.count="{ item }">{{ fmtInt(item.count) }}</template>
          <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
          <template #item.seeding_count="{ item }">{{ fmtInt(item.seeding_count) }}</template>
          <template #item.paused_count="{ item }">{{ fmtInt(item.paused_count) }}</template>
        </v-data-table>
      </v-card>

      <!-- 状态分布 -->
      <v-card class="mb-2" variant="outlined">
        <v-card-title class="text-subtitle-1 py-2">任务状态分布</v-card-title>
        <div class="pa-2 d-flex flex-wrap ga-1">
          <v-chip v-for="s in stateRows" :key="s.state" density="compact" variant="tonal">
            {{ s.state }} · <b>{{ fmtInt(s.count) }}</b>
          </v-chip>
          <span v-if="!stateRows.length" class="text-grey">暂无数据</span>
        </div>
      </v-card>

      <!-- 未识别站点 -->
      <v-card v-if="unidentified.length" variant="outlined">
        <v-card-title class="text-subtitle-1 py-2">未识别站点种子(供排查站点识别)</v-card-title>
        <div class="pa-2 max-h-200 overflow-auto">
          <div v-for="(u, i) in unidentified.slice(0, 40)" :key="i" class="d-flex justify-space-between">
            <span class="text-body-2">{{ u.name }}</span>
            <small class="text-grey">{{ u.downloader }}</small>
          </div>
          <span v-if="unidentified.length > 40" class="text-grey text-caption">
            还有 {{ unidentified.length - 40 }} 项未显示
          </span>
        </div>
      </v-card>
    </div>

    <!-- ======================= 本地清理 ======================= -->
    <div v-else>
      <v-row class="mb-2">
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">冗余候选</div>
              <div class="text-h6">{{ fmtInt(ldata.removable_count) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">可释放空间</div>
              <div class="text-h6 text-error">{{ formatSize(ldata.removable_size) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">扫描根目录</div>
              <div class="text-h6 text-primary">{{ fmtInt(ldata.roots?.length) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-card variant="tonal">
            <v-card-text class="pa-2 text-center">
              <div class="text-caption text-grey">空目录</div>
              <div class="text-h6">{{ fmtInt(emptyDirs.length) }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 磁盘路径映射校验:把 path_map 文本贴到这里,点「校验」逐行确认远程/本地前缀是否存在 -->
      <v-card class="mb-2" variant="outlined">
        <v-card-title class="text-subtitle-1 py-2 d-flex align-center ga-2">
          <v-icon>mdi-map-marker-path</v-icon>
          磁盘路径映射校验
          <v-spacer />
          <v-btn density="compact" color="primary" variant="flat" size="small"
            :loading="pathMapCheckLoading" @click="checkPathMap">
            <v-icon left>mdi-check-decagram</v-icon>校验
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-textarea
            v-model="pathMapInput"
            label="path_map (留空则校验已保存到插件配置的值)"
            rows="3"
            density="compact"
            variant="outlined"
            hint="每行 / 每 | 一项;格式: 远程前缀 = 本地根目录 (也支持 -> / =>)。校验只检查前缀是否存在,不写任何文件。"
            persistent-hint
          />
          <v-alert v-if="pathMapCheckError" type="error" density="compact" variant="tonal" class="mt-2">
            {{ pathMapCheckError }}
          </v-alert>
          <template v-if="pathMapCheckResult">
            <div class="d-flex flex-wrap ga-1 mt-2">
              <v-chip size="small" :color="pathMapCheckResult.ok ? 'success' : 'error'" variant="flat">
                <v-icon left>{{ pathMapCheckResult.ok ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
                {{ pathMapCheckResult.ok ? '全部通过' : '存在异常' }}
              </v-chip>
              <v-chip size="small" variant="tonal">共 {{ pathMapCheckResult.summary.total }} 行</v-chip>
              <v-chip size="small" color="success" variant="tonal" v-if="pathMapCheckResult.summary.ok">
                <v-icon left>mdi-check</v-icon>OK {{ pathMapCheckResult.summary.ok }}
              </v-chip>
              <v-chip size="small" color="warning" variant="tonal" v-if="pathMapCheckResult.summary.bad_remote">
                远程缺失 {{ pathMapCheckResult.summary.bad_remote }}
              </v-chip>
              <v-chip size="small" color="warning" variant="tonal" v-if="pathMapCheckResult.summary.bad_local">
                本地缺失 {{ pathMapCheckResult.summary.bad_local }}
              </v-chip>
              <v-chip size="small" color="error" variant="tonal" v-if="pathMapCheckResult.summary.bad_both">
                两端均缺 {{ pathMapCheckResult.summary.bad_both }}
              </v-chip>
              <v-chip size="small" color="error" variant="tonal" v-if="pathMapCheckResult.summary.bad_format">
                格式错 {{ pathMapCheckResult.summary.bad_format }}
              </v-chip>
              <v-spacer />
              <small class="text-grey">校验源: {{ pathMapCheckResult.source }}</small>
            </div>
            <v-data-table
              v-if="pathMapCheckResult.lines && pathMapCheckResult.lines.length"
              :headers="[
                { title: '#',         key: 'line_no', width: 50 },
                { title: '原始行',    key: 'raw' },
                { title: '远程前缀',  key: 'remote' },
                { title: '本地前缀',  key: 'local' },
                { title: '校验结果',  key: 'status', width: 130 },
              ]"
              :items="pathMapCheckResult.lines"
              :items-per-page="50"
              density="compact"
              class="elevation-0 mt-2"
            >
              <template #item.line_no="{ item }">
                <span class="text-grey">{{ item.line_no }}</span>
              </template>
              <template #item.raw="{ item }">
                <code class="text-caption">{{ item.raw }}</code>
              </template>
              <template #item.remote="{ item }">
                <code class="text-caption" :class="{ 'text-warning': !item.remote }">{{ item.remote || '—' }}</code>
              </template>
              <template #item.local="{ item }">
                <code class="text-caption" :class="{ 'text-warning': !item.local }">{{ item.local || '—' }}</code>
              </template>
              <template #item.status="{ item }">
                <v-tooltip :text="item.msg || ''" location="top">
                  <template #activator="{ props: tip }">
                    <v-chip v-bind="tip" size="x-small" :color="statusMeta(item.status).color" variant="flat">
                      <v-icon left size="x-small">{{ statusMeta(item.status).icon }}</v-icon>
                      {{ statusMeta(item.status).label }}
                    </v-chip>
                  </template>
                </v-tooltip>
              </template>
            </v-data-table>
            <div v-else class="text-grey text-caption mt-2">没有可校验的行 (留空?)</div>
          </template>
        </v-card-text>
      </v-card>

      <v-alert type="info" density="compact" variant="tonal" class="mb-2">
        仅对“扫描后不在任何做种种子内的文件”列为候选,删除需人工勾选确认;种子内文件绝不会被误判为可删除。
      </v-alert>
      <v-alert v-if="ldata.warnings && ldata.warnings.length" type="warning" density="compact" variant="tonal" class="mb-2">
        <div v-for="(w, i) in ldata.warnings" :key="i" class="text-caption">{{ w }}</div>
      </v-alert>

      <!-- 操作条 -->
      <div class="d-flex align-center ga-2 mb-2">
        <v-checkbox
          label="全选"
          hide-details
          density="compact"
          :indeterminate="selected.length > 0 && selected.length < removables.length"
          :model-value="removables.length > 0 && selected.length === removables.length"
          @update:model-value="toggleAll"
        />
        <small class="text-grey">已选 {{ selected.length }} 项 / {{ formatSize(selectedSize()) }}</small>
        <v-spacer />
        <v-btn density="compact" color="error" variant="tonal" size="small"
          :disabled="!selected.length" @click="deleteSelected">
          <v-icon left>mdi-trash-can</v-icon>删除所选
        </v-btn>
        <v-btn density="compact" color="error" variant="text" size="small"
          :disabled="!removables.length" @click="selected = removables.map(x => x.rel); deleteSelected()">
          清空所有候选
        </v-btn>
        <v-btn density="compact" color="orange-darken-1" variant="tonal" size="small"
          :disabled="!emptyDirs.length" @click="cleanEmptyDirs">
          <v-icon left>mdi-folder-remove</v-icon>清空目录({{ fmtInt(emptyDirs.length) }})
        </v-btn>
      </div>

      <!-- 候选列表 -->
      <v-card variant="outlined">
        <v-data-table
          v-model="selected"
          show-select
          item-value="rel"
          :headers="[
            { title: '相对路径', key: 'rel' },
            { title: '大小', key: 'size', align: 'end' },
          ]"
          :items="removables"
          :items-per-page="50"
          density="compact"
          class="elevation-0"
        >
          <template #item.rel="{ item }">{{ item.rel }}</template>
          <template #item.size="{ item }">{{ formatSize(item.size) }}</template>
        </v-data-table>
        <v-card-text v-if="!removables.length" class="text-center text-grey text-body-2">
          {{ localEmpty ? '从未扫描。请点击上方「本地扫描」生成候选清单。' : '本次扫描未发现冗余文件,磁盘与做种种子一致。' }}
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.max-h-200 {
  max-height: 200px;
}
</style>
