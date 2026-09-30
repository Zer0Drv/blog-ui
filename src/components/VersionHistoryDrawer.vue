<template>
  <el-drawer
    :model-value="visible"
    title="历史版本"
    size="520px"
    @update:model-value="v => emit('update:visible', v)"
    @open="load"
  >
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
          <el-button size="small" link type="warning" @click="onRestore(row)">恢复</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无历史版本（更新文章后自动产生快照）" />
      </template>
    </el-table>

    <!-- 版本内容只读预览 -->
    <el-dialog
      v-model="previewVisible"
      :title="`版本 v${preview?.version || ''} 预览`"
      width="720px"
      append-to-body
    >
      <div v-loading="previewLoading" class="preview-body">
        <template v-if="preview">
          <MdPreview
            v-if="preview.editorType === 'MARKDOWN'"
            :editor-id="previewId"
            :model-value="preview.content || ''"
          />
          <div v-else class="rich-preview" v-html="preview.content || ''"></div>
        </template>
      </div>
    </el-dialog>
  </el-drawer>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { getArticleVersion, listArticleVersions, restoreArticleVersion } from '../api/article'

const props = defineProps({
  visible: { type: Boolean, default: false },
  articleId: { type: [String, Number], required: true }
})
const emit = defineEmits(['update:visible', 'restored'])

const versions = ref([])
const loading = ref(false)
const previewVisible = ref(false)
const previewLoading = ref(false)
const preview = ref(null)
const previewId = `version-preview-${props.articleId}`

async function load() {
  loading.value = true
  try {
    versions.value = await listArticleVersions(props.articleId) || []
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

async function onPreview(row) {
  previewVisible.value = true
  previewLoading.value = true
  preview.value = null
  try {
    preview.value = await getArticleVersion(props.articleId, row.version)
  } catch { /* 拦截器已提示 */ } finally {
    previewLoading.value = false
  }
}

async function onRestore(row) {
  try {
    await ElMessageBox.confirm(
      `确认恢复到版本 v${row.version}？当前内容会先自动留存一个新快照。`,
      '恢复版本',
      { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' }
    )
  } catch { return }
  try {
    await restoreArticleVersion(props.articleId, row.version)
    ElMessage.success(`已恢复到版本 v${row.version}`)
    emit('restored')
    load()
  } catch { /* 拦截器已提示 */ }
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}
</script>

<style scoped>
.preview-body {
  min-height: 200px;
}
.rich-preview {
  line-height: 1.7;
  word-break: break-word;
}
</style>
