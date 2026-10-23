<template>
  <div class="sys-config">
    <el-card v-loading="loading">
      <template #header>
        <div class="toolbar"><strong>系统参数配置</strong><el-button type="primary" :loading="saving" :disabled="loading || !dirtyKeys.length" @click="save">保存更改</el-button></div>
      </template>
      <el-alert type="info" :closable="false" title="重置将恢复部署环境中的配置；环境未设置时使用默认值。标记为重启生效的参数，保存后需重启服务。" />
      <el-form :disabled="loading || saving" label-position="top">
        <section v-for="group in groups" :key="group.name">
          <h3>{{ group.name }}</h3>
          <el-form-item v-for="row in group.rows" :key="row.key" :label="row.description" class="config-row" :data-key="row.key">
            <div class="field">
              <el-switch v-if="row.type === 'BOOL'" v-model="values[row.key]" />
              <el-input-number v-else-if="row.type === 'INT'" v-model="values[row.key]" :min="row.validation.min" :max="row.validation.max" :precision="0" />
              <el-select v-else-if="row.type === 'JSON'" v-model="values[row.key]" multiple placeholder="选择允许的图片类型">
                <el-option v-for="option in row.validation.options" :key="option" :label="option" :value="option" />
              </el-select>
              <el-select v-else v-model="values[row.key]">
                <el-option v-for="option in row.validation.options" :key="option" :label="option" :value="option" />
              </el-select>
              <el-tag :type="row.hotReload ? 'success' : 'info'">{{ row.hotReload ? '热生效' : '重启生效' }}</el-tag>
              <el-tag v-if="row.restartRequired" type="warning">待重启</el-tag>
              <el-button class="reset-button" :disabled="row.source !== 'DATABASE'" @click="reset(row)">重置</el-button>
            </div>
            <div class="hint">来源：{{ sourceLabel(row.source) }} · 默认值：{{ display(row.defaultValue) }}<template v-if="row.restartRequired"> · 当前生效：{{ display(row.activeValue) }}</template></div>
            <div class="hint">{{ row.key }}</div>
          </el-form-item>
        </section>
      </el-form>
      <ApplicationRestart :dirty="dirtyKeys.length > 0 || saving" :rows="rows" @recovered="load" />
    </el-card>
    <el-card class="audit" v-loading="auditLoading">
      <template #header><div class="toolbar"><strong>变更记录</strong><el-button @click="loadAudit">刷新</el-button></div></template>
      <el-table :data="audit.records">
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column prop="operatorId" label="修改人 ID" width="110" />
        <el-table-column prop="key" label="参数" min-width="200" />
        <el-table-column label="操作" width="90"><template #default="{ row }">{{ row.action === 'RESET' ? '重置' : '修改' }}</template></el-table-column>
        <el-table-column label="旧值" min-width="130"><template #default="{ row }">{{ display(row.oldValue) }}</template></el-table-column>
        <el-table-column label="新值" min-width="130"><template #default="{ row }">{{ display(row.newValue) }}</template></el-table-column>
      </el-table>
      <el-pagination v-if="audit.total > 20" v-model:current-page="auditPage" :page-size="20" :total="audit.total" layout="prev, pager, next" @current-change="loadAudit" />
    </el-card>
  </div>
</template>

<script setup>
import ApplicationRestart from '../../components/ApplicationRestart.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSysConfig, updateSysConfig, resetSysConfig, getSysConfigAudit } from '../../api/sysConfig'

const loading = ref(false), saving = ref(false), auditLoading = ref(false)
const rows = ref([]), values = reactive({}), audit = ref({ records: [], total: 0 }), auditPage = ref(1)
const copy = value => JSON.parse(JSON.stringify(value))
const display = value => typeof value === 'string' ? value : JSON.stringify(value)
const sourceLabel = source => ({ DATABASE: '数据库', ENVIRONMENT: '环境变量', YAML: '部署配置', DEFAULT: '内置默认值' }[source] || source)
const dirtyKeys = computed(() => rows.value.filter(row => JSON.stringify(row.value) !== JSON.stringify(values[row.key])).map(row => row.key))
const groups = computed(() => {
  const result = new Map()
  for (const row of rows.value) {
    if (!result.has(row.group)) result.set(row.group, { name: row.group, rows: [] })
    result.get(row.group).rows.push(row)
  }
  return [...result.values()]
})

async function load(preserve = []) {
  loading.value = true
  try {
    const next = await getSysConfig()
    for (const row of next) if (!preserve.includes(row.key)) values[row.key] = copy(row.value)
    rows.value = next
    return true
  } catch { return false /* HTTP 拦截器提示；保留已有表单 */ }
  finally { loading.value = false }
}

async function loadAudit() {
  auditLoading.value = true
  try { audit.value = await getSysConfigAudit({ page: auditPage.value, size: 20 }) }
  catch { /* HTTP 拦截器提示 */ }
  finally { auditLoading.value = false }
}

async function save() {
  const changes = Object.fromEntries(dirtyKeys.value.map(key => [key, values[key]]))
  if (!Object.keys(changes).length) return
  if (Object.values(changes).some(value => value == null || (Array.isArray(value) && !value.length))) {
    ElMessage.warning('请填写有效参数，图片类型至少选择一项')
    return
  }
  saving.value = true
  try {
    await updateSysConfig(changes)
    const refreshed = await load()
    auditPage.value = 1
    await loadAudit()
    if (refreshed) ElMessage.success('系统参数已保存，请留意待重启提示')
    else ElMessage.warning('参数已保存，但重新读取失败，请刷新后核对')
  } catch { /* HTTP 拦截器提示；失败保留修改 */ }
  finally { saving.value = false }
}

async function reset(row) {
  try {
    await ElMessageBox.confirm('重置此参数将恢复部署环境或默认值，确认继续？', '重置参数', { type: 'warning' })
  } catch { return }
  const preserve = dirtyKeys.value.filter(key => key !== row.key)
  saving.value = true
  try {
    await resetSysConfig(row.key)
    const refreshed = await load(preserve)
    auditPage.value = 1
    await loadAudit()
    if (refreshed) ElMessage.success('参数已重置')
    else ElMessage.warning('参数已重置，但重新读取失败，请刷新后核对')
  } catch { /* HTTP 拦截器提示 */ }
  finally { saving.value = false }
}

onBeforeRouteLeave(async () => {
  if (saving.value) return false
  if (!dirtyKeys.value.length) return true
  try { await ElMessageBox.confirm('系统参数尚未保存，仍要离开？', '未保存的修改', { type: 'warning' }); return true }
  catch { return false }
})
onMounted(() => { load(); loadAudit() })
</script>

<style scoped>
.toolbar, .field { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar { justify-content: space-between; }
.hint { width: 100%; font-size: 12px; color: #606266; line-height: 1.7; overflow-wrap: anywhere; }
.field { width: 100%; }
.field .el-select { width: 280px; max-width: 100%; }
.config-row { padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }
.audit { margin-top: 20px; }
</style>
