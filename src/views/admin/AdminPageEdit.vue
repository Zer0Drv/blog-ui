<template>
  <el-card v-loading="loading">
    <template #header><span>{{ pageId ? '编辑页面' : '新建页面' }}</span></template>
    <el-form label-position="top">
      <el-form-item label="标题" required><el-input v-model="form.title" maxlength="200" /></el-form-item>
      <el-form-item label="Slug" required><el-input v-model="form.slug" maxlength="200" placeholder="如 about；访问地址 /pages/about" /></el-form-item>
      <el-form-item label="编辑模式">
        <el-radio-group v-model="form.editorType" :disabled="!!pageId" @change="changeMode">
          <el-radio value="MARKDOWN">Markdown</el-radio><el-radio value="RICHTEXT">富文本</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="正文" required>
        <div class="editor-wrap">
          <MdEditor v-if="form.editorType === 'MARKDOWN'" v-model="form.content" :on-upload-img="uploadImages" style="height: 500px" />
          <RichEditor v-else v-model="form.content" />
        </div>
      </el-form-item>
      <div class="actions">
        <el-button :loading="saving" @click="save('DRAFT')">保存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="save('PUBLISHED')">发布页面</el-button>
        <el-button v-if="savedStatus === 'PUBLISHED'" :loading="saving" @click="save('OFFLINE')">下架</el-button>
        <el-button @click="router.push('/admin/pages')">返回列表</el-button>
      </div>
      <p class="tip">导航入口请在「站点设置」中配置；仅已发布页面公开可见。</p>
    </el-form>
  </el-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import '../../lib/mdEditorConfig'
import 'md-editor-v3/lib/style.css'
import RichEditor from '../../components/RichEditor.vue'
import { createPage, getAdminPage, notifyPageNavigationChanged, updatePage } from '../../api/page'
import { uploadAndResolveUrl } from '../../api/upload'
import { SLUG_PATTERN, stripHtml } from '../../utils/articleEdit'

const route = useRoute()
const router = useRouter()
const pageId = computed(() => route.params.id || null)
const loading = ref(false)
const saving = ref(false)
const savedStatus = ref('DRAFT')
const form = reactive({ title: '', slug: '', content: '', editorType: 'MARKDOWN' })
let cleanState = JSON.stringify(form)
let previousMode = 'MARKDOWN'
async function changeMode(mode) {
  if (form.content.trim()) {
    form.editorType = previousMode
    try { await ElMessageBox.confirm('切换编辑模式会清空当前正文，是否继续？', '切换模式') }
    catch { return }
    form.content = ''
    form.editorType = mode
  }
  previousMode = mode
}
async function uploadImages(files, callback) {
  try { callback(await Promise.all(files.map(file => uploadAndResolveUrl(file)))) }
  catch { /* 拦截器已提示 */ }
}
async function save(status) {
  if (!form.title.trim() || !stripHtml(form.content).trim()) { ElMessage.warning('标题和正文不能为空'); return }
  if (!SLUG_PATTERN.test(form.slug.trim())) { ElMessage.warning('slug 仅允许小写字母、数字和连字符'); return }
  saving.value = true
  try {
    const data = { ...form, title: form.title.trim(), slug: form.slug.trim(), status }
    const id = pageId.value ? await updatePage(pageId.value, data) : await createPage(data)
    savedStatus.value = status
    cleanState = JSON.stringify(form)
    notifyPageNavigationChanged()
    ElMessage.success(status === 'PUBLISHED' ? '页面已发布' : status === 'OFFLINE' ? '页面已下架' : '草稿已保存')
    if (!pageId.value) await router.replace(`/admin/pages/${id}`)
  } catch { /* 拦截器已提示 */ } finally { saving.value = false }
}
onMounted(async () => {
  if (!pageId.value) return
  loading.value = true
  try {
    const data = await getAdminPage(pageId.value)
    for (const key of Object.keys(form)) form[key] = data[key] || ''
    previousMode = form.editorType
    savedStatus.value = data.status
    cleanState = JSON.stringify(form)
  } catch { router.replace('/admin/pages') }
  finally { loading.value = false }
})
async function confirmLeave() {
  if (JSON.stringify(form) === cleanState) return true
  try { await ElMessageBox.confirm('页面有未保存的修改，确认离开？', '未保存的修改'); return true }
  catch { return false }
}
onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(confirmLeave)
</script>

<style scoped>
.editor-wrap { width: 100%; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.tip { color: #909399; font-size: 13px; }
</style>
