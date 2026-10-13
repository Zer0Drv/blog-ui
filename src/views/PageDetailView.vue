<template>
  <el-card class="page-detail">
    <el-skeleton v-if="loading" :rows="8" animated />
    <template v-else-if="page">
      <h1>{{ page.title }}</h1>
      <MdContentPreview v-if="page.editorType === 'MARKDOWN'" :content="page.content" :editor-id="`page-${page.id}`" />
      <div v-else class="richtext" v-html="sanitizedContent" />
    </template>
    <el-empty v-else description="页面不存在或未发布" />
  </el-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPage } from '../api/page'
import { useDocumentTitle } from '../composables/useDocumentTitle'
import { sanitizeHtml } from '../utils/sanitize'
import MdContentPreview from '../components/MdContentPreview.vue'

const route = useRoute()
const page = ref(null)
const loading = ref(true)
const { setTitle } = useDocumentTitle()
const sanitizedContent = computed(() => sanitizeHtml(page.value?.content || ''))
let sequence = 0
async function load() {
  const request = ++sequence
  page.value = null
  loading.value = true
  setTitle('页面')
  try {
    const data = await getPage(route.params.slug)
    if (request !== sequence) return
    page.value = data
    setTitle(data?.title)
  } catch { /* 拦截器提示，保留空页 */ }
  finally { if (request === sequence) loading.value = false }
}
onMounted(load)
watch(() => route.params.slug, load)
</script>

<style scoped>
.page-detail { max-width: 860px; margin: 0 auto; }
h1 { margin-top: 0; }
.richtext :deep(img) { max-width: 100%; }
</style>
