<template>
  <div class="my-articles">
    <el-card>
      <template #header>
        <div class="header">
          <span>我的文章</span>
          <div class="header-right">
            <el-select
              v-model="status"
              placeholder="全部状态"
              clearable
              style="width: 140px"
              @change="onFilter"
            >
              <el-option label="草稿" value="DRAFT" />
              <el-option label="已发布" value="PUBLISHED" />
              <el-option label="已下架" value="OFFLINE" />
            </el-select>
            <el-button :loading="importing" @click="triggerImport">导入文章</el-button>
            <el-button type="primary" @click="router.push('/editor/new')">写文章</el-button>
            <!-- 导入：隐藏 file input，前端先校验扩展名与 2MB 大小 -->
            <input
              ref="importInput"
              type="file"
              accept=".md,.markdown,.txt,.html,.htm"
              style="display: none"
              @change="onImportFile"
            />
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="goView(row)">{{ row.title }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tooltip v-if="isScheduled(row)" :content="`将于 ${formatTime(row.publishTime)} 发布`" placement="top">
              <el-tag type="warning" size="small">定时中</el-tag>
            </el-tooltip>
            <el-tag v-else :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" width="120">
          <template #default="{ row }">{{ row.categoryName || '-' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="270" fixed="right">
          <template #default="{ row }">
            <!-- 回收站：恢复 / 彻底删除 -->
            <template v-if="row.status === 'TRASH'">
              <el-button size="small" link type="success" @click="onRestore(row)">恢复</el-button>
              <el-button size="small" link type="danger" @click="onForceDelete(row)">彻底删除</el-button>
            </template>
            <template v-else>
              <el-button size="small" link type="primary" @click="router.push(`/editor/${row.id}`)">
                编辑
              </el-button>
              <el-button
                v-if="row.status !== 'PUBLISHED'"
                size="small"
                link
                type="success"
                @click="onChangeStatus(row, 'PUBLISHED')"
              >发布</el-button>
              <el-button
                v-if="row.status === 'PUBLISHED'"
                size="small"
                link
                type="warning"
                @click="onChangeStatus(row, 'OFFLINE')"
              >下架</el-button>
              <el-button size="small" link @click="onExport(row)">导出</el-button>
              <el-button size="small" link type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文章" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="onFilter"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteArticle, exportArticle, forceDeleteArticle, importArticle, pageMyArticles, restoreArticle, updateArticleStatus } from '../api/article'

const router = useRouter()

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const status = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await pageMyArticles({
      page: page.value,
      size: size.value,
      status: status.value || undefined
    })
    rows.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onFilter() {
  page.value = 1
  load()
}

function goView(row) {
  // 作者本人/ADMIN 可在详情页查看任意状态（契约）
  router.push(`/article/${row.id}`)
}

async function onChangeStatus(row, target) {
  const action = target === 'PUBLISHED' ? '发布' : '下架'
  try {
    await ElMessageBox.confirm(`确认${action}《${row.title}》？`, '提示', { type: 'warning' })
  } catch { return }
  try {
    await updateArticleStatus(row.id, target)
    ElMessage.success(`${action}成功`)
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除《${row.title}》？删除后可在回收站恢复。`, '警告', {
      type: 'error',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await deleteArticle(row.id)
    ElMessage.success('已删除，可在回收站恢复')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onRestore(row) {
  try {
    await ElMessageBox.confirm(`确认恢复《${row.title}》？恢复后将回到草稿状态。`, '提示', {
      type: 'info',
      confirmButtonText: '恢复',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await restoreArticle(row.id)
    ElMessage.success('已恢复为草稿')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    load()
  } catch { /* 拦截器已提示 */ }
}

async function onForceDelete(row) {
  try {
    await ElMessageBox.confirm(`确认彻底删除《${row.title}》？删除后不可恢复！`, '警告', {
      type: 'error',
      confirmButtonText: '彻底删除',
      cancelButtonText: '取消'
    })
  } catch { return }
  try {
    await forceDeleteArticle(row.id)
    ElMessage.success('已彻底删除')
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    load()
  } catch { /* 拦截器已提示 */ }
}

// 导入：支持 .md/.markdown/.txt（MARKDOWN 草稿）与 .html/.htm（RICHTEXT 草稿），≤2MB
const importInput = ref(null)
const importing = ref(false)
const IMPORT_ACCEPT_EXT = ['.md', '.markdown', '.txt', '.html', '.htm']
const IMPORT_MAX_SIZE = 2 * 1024 * 1024

function triggerImport() {
  importInput.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // 允许重复选择同一文件
  if (!file) return
  const name = (file.name || '').toLowerCase()
  if (!IMPORT_ACCEPT_EXT.some(ext => name.endsWith(ext))) {
    ElMessage.error('仅支持 .md/.markdown/.txt/.html/.htm 文件')
    return
  }
  if (file.size > IMPORT_MAX_SIZE) {
    ElMessage.error('文件大小不能超过 2MB')
    return
  }
  importing.value = true
  try {
    const data = await importArticle(file)
    ElMessage.success('导入成功，已创建草稿')
    router.push(`/editor/${data.id}`)
  } catch { /* 拦截器已提示 */ } finally {
    importing.value = false
  }
}

// 导出：按编辑器类型选择默认格式（MARKDOWN→md / RICHTEXT→html）
async function onExport(row) {
  try {
    await exportArticle(row.id, row.editorType === 'RICHTEXT' ? 'html' : 'md')
  } catch { /* 拦截器已提示 */ }
}

// 定时中：已发布但发布时间晚于当前（publishTime 已在 ArticleListVO）
function isScheduled(row) {
  return row.status === 'PUBLISHED' && row.publishTime
    && new Date(String(row.publishTime).replace(' ', 'T')).getTime() > Date.now()
}

function statusText(s) {
  return { DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下架' }[s] || s
}

function statusType(s) {
  return { DRAFT: 'info', PUBLISHED: 'success', OFFLINE: 'warning' }[s] || 'info'
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

onMounted(load)
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-right {
  display: flex;
  gap: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
