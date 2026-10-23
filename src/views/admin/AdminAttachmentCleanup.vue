<template>
  <section class="cleanup">
    <h2>附件清理</h2>
    <p>先从附件库移除文件，再扫描孤儿对象。上传满 1 天且无引用的对象会进入 7 天观察期，观察期间链接保持可用。</p>
    <p>文章、版本历史、自动保存草稿、回收站等内容中的图片会保留。恢复后对象保留在库中；物理删除后无法恢复。</p>
    <p>仅支持系统管理的 JPG、PNG、GIF、WebP 图片；HTML、SVG、PDF、压缩包等其他文件不提供预览或下载。</p>
    <div class="toolbar">
      <el-button data-testid="scan" type="primary" :disabled="busy || loading" @click="scan">扫描孤儿对象</el-button>
      <el-button data-testid="refresh" :disabled="busy || loading" @click="load">刷新</el-button>
      <span>已确认回收对象大小：<strong>{{ bytes(report.reclaimedBytes || 0) }}</strong></span>
    </div>
    <p class="hint">统计为已删除对象的逻辑大小；MinIO 版本保留或存储策略可能影响实际磁盘空间。</p>
    <p v-if="scanResult" role="status">本次扫描 {{ scanResult.scanned }} 个对象，保护 {{ scanResult.protected }} 个，新增或重置观察期 {{ scanResult.marked }} 个。</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div v-if="report.states?.length" class="totals">
      <span v-for="item in report.states" :key="item.state">{{ label(item.state) }}：{{ item.objectCount }} 个 / {{ bytes(item.sizeBytes) }}</span>
    </div>
    <div class="table-wrap" :aria-busy="loading || busy">
      <table>
        <thead><tr><th>对象</th><th>大小</th><th>状态</th><th>观察期结束</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" :data-testid="`object-${row.id}`">
            <td><span>{{ row.storage }}</span><br><code>{{ row.objectKey }}</code>
              <p>文件类型：{{ fileType(row.objectKey) }}</p>
              <ObjectPreview v-if="managedImage(row.objectKey) && ['OBSERVING', 'RETAINED', 'RESTORED'].includes(row.state)"
                :src="`/api/admin/attachments/cleanup/${row.id}/preview`"
                :original="`/api/admin/attachments/cleanup/${row.id}/preview?download=true`" download />
              <span v-else>{{ managedImage(row.objectKey) ? '不可预览' : '不支持此文件：仅可预览或下载系统管理的图片' }}</span>
            </td>
            <td>{{ bytes(row.sizeBytes) }}</td>
            <td>{{ label(row.state) }}<p v-if="row.lastError" class="error">{{ row.lastError }}</p></td>
            <td>{{ date(row.eligibleAt) }}</td>
            <td class="actions">
              <el-button v-if="['OBSERVING', 'RETAINED', 'PURGING'].includes(row.state)" :data-testid="`restore-${row.id}`" :disabled="busy || loading" @click="restore(row)">恢复并保留</el-button>
              <el-button v-if="['OBSERVING', 'PURGING'].includes(row.state)" :data-testid="`purge-${row.id}`" type="danger" :disabled="!row.canPurge || busy || loading" @click="purge(row)">{{ row.state === 'PURGING' ? '重试清理' : '物理删除' }}</el-button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5">{{ loading ? '加载中…' : '暂无清理记录' }}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="toolbar pagination">
      <el-button data-testid="previous" :disabled="page <= 1 || busy || loading" @click="changePage(-1)">上一页</el-button>
      <span>第 {{ page }} 页 · 共 {{ total }} 个对象</span>
      <el-button data-testid="next" :disabled="page * 20 >= total || busy || loading" @click="changePage(1)">下一页</el-button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import ObjectPreview from '../../components/ObjectPreview.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pageAttachmentCleanup, getAttachmentCleanupReport, scanAttachmentObjects, restoreAttachmentObject, purgeAttachmentObject } from '../../api/attachmentCleanup'

const rows = ref([]), report = ref({}), total = ref(0), page = ref(1)
const loading = ref(false), busy = ref(false), error = ref(''), scanResult = ref(null)
const labels = { OBSERVING: '观察中', RETAINED: '引用保护', RESTORED: '已恢复保留', PURGING: '清理待完成', DELETED: '已物理删除', MISSING: '对象已不存在' }
const label = state => labels[state] || state
const managedImage = key => typeof key === 'string' && /^[0-9]{4}(?:0[1-9]|1[0-2])\/[a-f0-9]{32}\.(?:jpg|jpeg|png|gif|webp)$/.test(key)
const fileType = key => { const extension = String(key || '').match(/\.([a-z0-9]{1,10})$/i)?.[1]; return extension ? extension.toUpperCase() : '未知' }
const bytes = value => Number(value) < 1024 ? `${Number(value)} B` : Number(value) < 1048576 ? `${(Number(value) / 1024).toFixed(1)} KB` : `${(Number(value) / 1048576).toFixed(2)} MB`
const date = value => value ? new Date(value).toLocaleString() : '—'

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [list, stats] = await Promise.all([pageAttachmentCleanup({ page: page.value, size: 20 }), getAttachmentCleanupReport()])
    rows.value = list.records
    total.value = list.total
    report.value = stats
    return true
  } catch (e) {
    error.value = `加载失败，当前列表可能不是最新状态：${e.message || '请重试'}`
    return false
  } finally { loading.value = false }
}

async function mutate(action, success) {
  if (busy.value || loading.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await action()
    ElMessage.success(success(result))
    if (!await load()) error.value = '操作已完成，但列表刷新失败；请刷新后查看最新状态。'
  } catch (e) {
    error.value = `操作未确认完成：${e.message || '请刷新后重试'}`
    // A timed-out delete may have committed; refresh is required before another attempt.
    await loadAfterFailure(error.value)
  } finally { busy.value = false }
}

async function loadAfterFailure(message) {
  await load()
  error.value = message
}

function scan() {
  return mutate(async () => { const result = await scanAttachmentObjects(); scanResult.value = result; return result }, () => '扫描完成')
}

function restore(row) {
  return mutate(() => restoreAttachmentObject(row.id), () => '对象已恢复并保留')
}

async function purge(row) {
  if (busy.value || loading.value || !row.canPurge) return
  try {
    await ElMessageBox.confirm(`确认物理删除 ${row.objectKey}（${bytes(row.sizeBytes)}）？删除后无法恢复。执行前会重新检查引用。`, '物理删除附件', { type: 'warning', confirmButtonText: '物理删除', cancelButtonText: '取消' })
  } catch { return }
  return mutate(() => purgeAttachmentObject(row.id), result => ({ DELETED: '对象已物理删除', MISSING: '对象已不存在，未计入回收空间', RETAINED: '发现引用，已保留对象', OBSERVING: '对象发生变化，已重新开始观察期', RESTORED: '对象已恢复保留' }[result.state] || '清理状态已更新'))
}

async function changePage(delta) {
  const previous = page.value
  page.value += delta
  if (!await load()) page.value = previous
}

onMounted(load)
</script>

<style scoped>
.cleanup { background: #fff; padding: 24px; border-radius: 8px; }
h2 { margin-top: 0; }
p { line-height: 1.7; }
.toolbar, .totals { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 16px 0; }
.hint { color: #606266; font-size: 13px; }
.error { color: #b42318; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
th, td { padding: 14px 10px; border-bottom: 1px solid #ebeef5; vertical-align: top; }
th { color: #606266; }
code { overflow-wrap: anywhere; }
.actions { min-width: 220px; }
.pagination { justify-content: flex-end; }
</style>
