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
      width="720px"
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
import { computed, ref } from 'vue'
import { getArticleVersion, listArticleVersions } from '../api/article'
import { sanitizeHtml } from '../utils/sanitize'
import MdContentPreview from './MdContentPreview.vue'

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
const previewId = `version-preview-${props.articleId}`

// #9：历史快照同样可能包含恶意 HTML，预览前消毒
const sanitizedPreview = computed(() => sanitizeHtml(preview.value?.content || ''))

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
