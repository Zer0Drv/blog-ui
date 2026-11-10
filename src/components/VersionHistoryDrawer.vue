<template>
  <el-drawer
    :model-value="visible"
    title="历史版本"
    size="min(680px, 100vw)"
    @update:model-value="v => emit('update:visible', v)"
  >
    <form v-if="versions.length" class="compare-controls" @submit.prevent="compare">
      <label>基准版本
        <select v-model="fromVersion">
          <option v-for="version in versions" :key="version.version" :value="version.version">v{{ version.version }}</option>
        </select>
      </label>
      <label>对比目标
        <select v-model="toVersion">
          <option value="saved">当前已保存稿</option>
          <option v-for="version in versions" :key="version.version" :value="version.version">v{{ version.version }}</option>
        </select>
      </label>
      <el-button native-type="submit" type="primary" :loading="comparing">对比版本</el-button>
    </form>
    <p v-if="compareFailed" role="alert">无法读取版本，请重试。</p>
    <ArticleVersionComparison v-if="comparison" v-bind="comparison" />
    <el-table v-loading="loading" :data="versions" stripe>
      <el-table-column prop="version" label="版本" width="70">
        <template #default="{ row }">v{{ row.version }}</template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="150" show-overflow-tooltip />
      <el-table-column label="保存时间" width="150">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="onPreview(row)">查看</el-button>
          <el-button size="small" link type="warning" :disabled="busy" @click="emit('restore', row.version)">恢复</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无历史版本（更新文章后自动产生快照）" />
      </template>
    </el-table>

    <!-- 版本内容只读预览（#9：渲染前统一 DOMPurify 消毒） -->
    <el-dialog
      v-model="previewVisible"
      :title="`版本 v${preview?.version || ''} 预览`"
      width="min(720px, calc(100vw - 32px))"
      append-to-body
    >
      <div v-loading="previewLoading" class="preview-body">
        <template v-if="preview">
          <MdContentPreview
            v-if="preview.editorType === 'MARKDOWN'"
            :content="preview.content || ''"
            :editor-id="previewId"
          />
          <div v-else class="rich-preview" v-html="sanitizedPreview"></div>
        </template>
      </div>
    </el-dialog>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getArticleEditing, getArticleVersion, listArticleVersions } from '../api/article'
import { sanitizeHtml } from '../utils/sanitize'
import MdContentPreview from './MdContentPreview.vue'
import ArticleVersionComparison from './ArticleVersionComparison.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  articleId: { type: [String, Number], required: true },
  busy: { type: Boolean, default: false }
})
// The editor owns flushing, the revision token and restore confirmation.
const emit = defineEmits(['update:visible', 'restore'])

const versions = ref([])
const loading = ref(false)
const previewVisible = ref(false)
const previewLoading = ref(false)
const preview = ref(null)
const previewId = computed(() => `version-preview-${props.articleId}`)
const fromVersion = ref(null)
const toVersion = ref('saved')
const comparison = ref(null)
const comparing = ref(false)
const compareFailed = ref(false)
let request = 0
let listRequest = 0
let previewRequest = 0

watch([fromVersion, toVersion, () => props.articleId, () => props.visible], () => {
  request++
  comparison.value = null
  comparing.value = false
  compareFailed.value = false
}, { flush: 'sync' })
watch([() => props.articleId, () => props.visible], () => {
  listRequest++
  previewRequest++
  versions.value = []
  previewVisible.value = false
  if (props.visible) load()
}, { immediate: true, flush: 'sync' })

// #9：历史快照同样可能包含恶意 HTML，预览前消毒
const sanitizedPreview = computed(() => sanitizeHtml(preview.value?.content || ''))

async function load() {
  const ticket = ++listRequest
  loading.value = true
  fromVersion.value = null
  toVersion.value = 'saved'
  try {
    const rows = await listArticleVersions(props.articleId) || []
    if (ticket !== listRequest) return
    versions.value = rows
    fromVersion.value = rows[0]?.version ?? null
  } catch { /* 拦截器已提示 */ } finally {
    if (ticket === listRequest) loading.value = false
  }
}

async function compare() {
  if (comparing.value || fromVersion.value == null) return
  const ticket = ++request
  const id = props.articleId
  const from = fromVersion.value
  const to = toVersion.value
  comparing.value = true
  compareFailed.value = false
  comparison.value = null
  try {
    const before = getArticleVersion(id, from)
    const after = to === 'saved' ? getArticleEditing(id) : to === from ? before : getArticleVersion(id, to)
    const [left, right] = await Promise.all([before, after])
    if (ticket !== request) return
    comparison.value = {
      before: left, after: right, beforeLabel: `v${from}`,
      afterLabel: to === 'saved' ? '当前已保存稿' : `v${to}`
    }
  } catch {
    if (ticket === request) compareFailed.value = true
  } finally {
    if (ticket === request) comparing.value = false
  }
}

async function onPreview(row) {
  const ticket = ++previewRequest
  previewVisible.value = true
  previewLoading.value = true
  preview.value = null
  try {
    const result = await getArticleVersion(props.articleId, row.version)
    if (ticket === previewRequest) preview.value = result
  } catch { /* 拦截器已提示 */ } finally {
    if (ticket === previewRequest) previewLoading.value = false
  }
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}
</script>

<style scoped>
.compare-controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: end; margin-bottom: 16px; }
.compare-controls label { display: grid; gap: 4px; }
.compare-controls select { min-height: 32px; font: inherit; }
.comparison { margin-bottom: 16px; }
.preview-body {
  min-height: 200px;
}
.rich-preview {
  line-height: 1.7;
  word-break: break-word;
}
</style>
