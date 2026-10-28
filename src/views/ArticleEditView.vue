<template>
  <div class="editor-page">
    <el-card v-loading="pageLoading">
      <div v-if="loadFailed" role="alert" class="editor-alert">文章工作区无法加载。<el-button @click="loadExisting">重试加载</el-button></div>
      <div v-if="articleId && !pageLoading && !loadFailed" class="working-state" role="status">
        <p v-if="isPublished">当前编辑与线上版本分开保存，只有点击「更新发布」才会替换生效内容。</p>
        <p v-if="hasWorkingCopy">存在未发布的修改草稿{{ workingCopyUpdatedAt ? `（${formatDate(workingCopyUpdatedAt)}）` : '' }}。</p>
        <p v-if="isScheduled">当前定时发布计划：{{ formatDate(activePublishTime) }}。保存和更新发布均保留此计划。</p>
      </div>
      <div v-if="conflicted" class="editor-alert" role="alert">
        <p>服务器已有较新版本，本地修改已保留。请先对比，再决定是否重新加载。</p>
        <el-button :loading="comparing" @click="compareLatest">对比服务器版本</el-button>
        <el-button :disabled="saving" @click="reloadLatest">重新加载最新稿</el-button>
      </div>
      <el-form label-position="top" :disabled="pageLoading || saving || loadFailed" :inert="pageLoading || saving || loadFailed">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="200" show-word-limit placeholder="请输入文章标题" />
        </el-form-item>
        <el-form-item label="摘要">
          <el-input
            v-model="form.summary"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
            placeholder="留空则自动截取正文前 200 字"
          />
        </el-form-item>
        <!-- 固定链接（Zer0Drv/blog#14）：留空由后端按标题自动生成；编辑留空保持现状 -->
        <el-form-item label="固定链接（slug）">
          <el-input
            v-model="form.slug"
            maxlength="200"
            placeholder="留空自动生成；仅小写字母、数字与连字符，如 my-first-post"
          />
        </el-form-item>
        <div class="row">
          <el-form-item label="封面" class="row-item">
            <div class="cover-box">
              <img v-if="form.cover" :src="resolveUploadUrl(form.cover)" class="cover-preview" alt="cover" />
              <el-upload
                :show-file-list="false"
                accept="image/jpeg,image/png,image/gif,image/webp"
                :http-request="onCoverUpload"
              >
                <el-button :loading="coverUploading">{{ form.cover ? '更换封面' : '上传封面' }}</el-button>
              </el-upload>
              <el-button @click="pickerVisible = true">从附件库选择</el-button>
              <el-button v-if="form.cover" link type="danger" @click="form.cover = ''">移除</el-button>
            </div>
          </el-form-item>
          <el-form-item label="分类" class="row-item">
            <el-tree-select
              v-model="form.categoryId"
              :data="categories"
              :props="{ label: 'name', children: 'children' }"
              node-key="id"
              check-strictly
              clearable
              :render-after-expand="false"
              placeholder="选择分类"
              class="full-width"
            />
          </el-form-item>
          <el-form-item label="标签" class="row-item">
            <el-select v-model="form.tagIds" multiple clearable placeholder="选择标签" class="full-width">
              <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="可见性">
          <el-radio-group v-model="form.visibility" @change="form.accessPassword = ''">
            <el-radio value="PUBLIC">公开</el-radio>
            <el-radio value="PASSWORD">密码保护</el-radio>
            <el-radio value="PRIVATE">私密（仅作者和管理员）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.visibility === 'PASSWORD'" label="访问口令" :required="!form.hasAccessPassword">
          <el-input v-model="form.accessPassword" type="password" show-password maxlength="64"
            autocomplete="new-password" :placeholder="form.hasAccessPassword ? '留空保留原口令；填写则更换口令' : '设置 4~64 个字符的访问口令'" />
        </el-form-item>
        <el-form-item label="编辑模式">
          <el-radio-group
            v-model="form.editorType"
            :disabled="modeLocked"
            @change="onEditorTypeChange"
          >
            <el-radio-button value="MARKDOWN">Markdown</el-radio-button>
            <el-radio-button value="RICHTEXT">富文本</el-radio-button>
          </el-radio-group>
          <span v-if="modeLocked" class="lock-tip">编辑已有文章时模式已锁定（{{ form.editorType }}）</span>
        </el-form-item>

        <el-form-item label="正文" required>
          <div class="editor-wrap">
            <MdEditor
              v-if="form.editorType === 'MARKDOWN'"
              v-model="mdContent"
              :editor-id="mdEditorId"
              :on-upload-img="onMdUploadImg"
              placeholder="支持 Markdown 语法，可直接粘贴/上传图片"
              style="height: 520px"
            />
            <RichEditor v-else v-model="htmlContent" />
          </div>
        </el-form-item>

        <div class="actions">
          <span v-if="autosaveTip" class="autosave-tip">{{ autosaveTip }}</span>
          <!-- 导入 .md/.zip：创建新草稿并跳转；导出：仅已保存的文章可导出 -->
          <el-button :loading="importing" @click="triggerImport">导入</el-button>
          <input
            ref="importInput"
            type="file"
            :accept="IMPORT_ACCEPT"
            style="display: none"
            @change="onImportFile"
          />
          <el-button v-if="articleId" :loading="exporting" @click="onExport">导出</el-button>
          <el-button v-if="articleId" :disabled="actionsDisabled" @click="historyVisible = true">历史版本</el-button>
          <el-button v-if="articleId" :disabled="actionsDisabled" @click="previewWorkingCopy">预览修改</el-button>
          <el-button v-if="articleId && (hasWorkingCopy || autosave.dirty.value)" :disabled="actionsDisabled" @click="discardWorkingCopy">放弃修改</el-button>
          <el-button :loading="saving" :disabled="actionsDisabled" @click="onSave('DRAFT')">{{ isPublished ? '保存修改草稿' : '保存草稿' }}</el-button>
          <el-button type="primary" :loading="saving" :disabled="actionsDisabled" @click="openPublishDialog">{{ isPublished ? '更新发布' : '发布' }}</el-button>
        </div>
      </el-form>
    </el-card>

    <!-- 发布方式弹窗：立即 / 定时 -->
    <el-dialog v-model="publishDialogVisible" title="发布文章" width="420px">
      <el-radio-group v-model="publishMode">
        <el-radio value="now">立即发布</el-radio>
        <el-radio value="schedule">定时发布</el-radio>
      </el-radio-group>
      <div v-if="publishMode === 'schedule'" class="schedule-box">
        <el-date-picker
          v-model="publishTime"
          type="datetime"
          placeholder="选择发布时间"
          :disabled-date="disabledPublishDate"
        />
        <div class="schedule-tip">发布时间需晚于当前时间至少 5 分钟</div>
      </div>
      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmPublish">确认发布</el-button>
      </template>
    </el-dialog>

    <!-- 历史版本抽屉 -->
    <VersionHistoryDrawer
      v-if="articleId"
      v-model:visible="historyVisible"
      :article-id="articleId"
      :busy="saving || conflicted"
      @restore="restoreVersion"
    />

    <el-dialog v-model="previewVisible" title="修改草稿预览" width="min(800px, 94vw)">
      <template v-if="preview">
        <h2>{{ preview.title }}</h2><p>{{ preview.summary }}</p>
        <MdContentPreview v-if="preview.editorType === 'MARKDOWN'" :content="preview.content || ''" :editor-id="`working-preview-${articleId}`" />
        <div v-else class="rich-preview" v-html="sanitizeHtml(preview.content || '')"></div>
      </template>
    </el-dialog>
    <el-dialog v-model="comparisonVisible" title="版本对比" width="min(1100px, 96vw)">
      <div v-if="comparison" class="comparison-grid">
        <section><h3>本地修改</h3><p>{{ form.title }}</p><textarea aria-label="本地正文" readonly :value="currentContent()" /></section>
        <section><h3>服务器版本</h3><p>{{ comparison.title }}</p><textarea aria-label="服务器正文" readonly :value="comparison.content || ''" /></section>
      </div>
      <p>对比不会覆盖本地内容。复制需要保留的内容后，可重新加载最新稿。</p>
    </el-dialog>

    <!-- 封面附件库选择 -->
    <AttachmentPicker v-model:visible="pickerVisible" @select="onPickCover" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import '../lib/mdEditorConfig'
import 'md-editor-v3/lib/style.css'
import {
  createArticle,
  autosaveArticle,
  discardArticleWorkingCopy,
  exportArticle,
  getArticleEditing,
  getAutosave,
  publishArticle,
  restoreArticleVersion,
  updateArticle
} from '../api/article'
import { listCategories } from '../api/category'
import { listTags } from '../api/tag'
import { resolveUploadUrl, uploadAndResolveUrl, uploadImage } from '../api/upload'
import { useAuthStore } from '../stores/auth'
import AttachmentPicker from '../components/AttachmentPicker.vue'
import RichEditor from '../components/RichEditor.vue'
import VersionHistoryDrawer from '../components/VersionHistoryDrawer.vue'
import MdContentPreview from '../components/MdContentPreview.vue'
import { sanitizeHtml } from '../utils/sanitize'
import { IMPORT_ACCEPT, useArticleImport } from '../composables/useArticleImport'
import {
  DRAFT_NEW_KEY,
  articleToFormState,
  buildAutosaveBody,
  canEditArticle,
  draftToFormPatch,
  formatClock,
  formatLocalDateTime,
  needsSwitchConfirm,
  parseLocalDraft,
  shouldOfferServerDraft,
  validateArticle,
  validatePublishTime
} from '../utils/articleEdit'
import { useArticleAutosave } from '../composables/useArticleAutosave'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// MainLayout 按编辑路径重建组件；ID 固定属于本次表单，卸载时不能读取目标路由的 ID。
const articleId = ref(route.params.id || null)
let active = true
let documentGeneration = 0
let contentGeneration = 0
let coverUploadSequence = 0
const captureContext = () => ({ id: articleId.value, generation: documentGeneration })
const ownsContext = context => active && context.id === articleId.value && context.generation === documentGeneration
onBeforeUnmount(() => { active = false })
const modeLocked = ref(false)
const pageLoading = ref(true)
const saving = ref(false)
const coverUploading = ref(false)
const loadFailed = ref(false)
const editRevision = ref(null)
const activeStatus = ref('DRAFT')
const activePublishTime = ref(null)
const hasWorkingCopy = ref(false)
const workingCopyUpdatedAt = ref(null)
const conflicted = ref(false)
const comparing = ref(false)
const comparisonVisible = ref(false)
const comparison = ref(null)
const previewVisible = ref(false)
const preview = ref(null)
const isPublished = computed(() => activeStatus.value === 'PUBLISHED')
const actionsDisabled = computed(() => pageLoading.value || saving.value || loadFailed.value || conflicted.value)
const isScheduled = computed(() => isPublished.value && activePublishTime.value && new Date(activePublishTime.value).getTime() > Date.now())

const form = reactive({
  title: '',
  summary: '',
  slug: '',
  cover: '',
  categoryId: null,
  tagIds: [],
  editorType: 'MARKDOWN',
  visibility: 'PUBLIC',
  accessPassword: '',
  hasAccessPassword: false
})
const mdContent = ref('')
const htmlContent = ref('')
const categories = ref([])
const tags = ref([])

const mdEditorId = `md-editor-${articleId.value || 'new'}`

/* ---------- Markdown 图片上传 ---------- */
async function onMdUploadImg(files, callback) {
  const context = captureContext()
  const generation = contentGeneration
  try {
    const urls = await Promise.all(files.map(f => uploadAndResolveUrl(f)))
    if (ownsContext(context) && generation === contentGeneration) callback(urls)
  } catch { /* 拦截器已提示 */ }
}

/* ---------- 封面上传 ---------- */
async function onCoverUpload({ file }) {
  const context = captureContext()
  const generation = contentGeneration
  const sequence = ++coverUploadSequence
  coverUploading.value = true
  try {
    const data = await uploadImage(file)
    if (!ownsContext(context) || generation !== contentGeneration || sequence !== coverUploadSequence) return
    form.cover = data.url
    ElMessage.success('封面上传成功')
  } catch { /* 拦截器已提示 */ } finally {
    if (ownsContext(context) && sequence === coverUploadSequence) coverUploading.value = false
  }
}

/* ---------- 模式切换 ---------- */
const prevEditorType = ref('MARKDOWN')

function onEditorTypeChange(val) {
  const context = captureContext()
  const generation = contentGeneration
  const prev = prevEditorType.value
  const doSwitch = () => {
    invalidateUploads()
    prevEditorType.value = val
  }
  if (!needsSwitchConfirm(prev, mdContent.value, htmlContent.value)) {
    doSwitch()
    return
  }
  // 先回滚，确认后再切换
  form.editorType = prev
  ElMessageBox.confirm(
    'Markdown 与富文本内容不互通，切换后原内容不会自动转换，确认切换？',
    '切换编辑模式',
    { type: 'warning', confirmButtonText: '切换', cancelButtonText: '取消' }
  ).then(() => {
    if (!ownsContext(context) || generation !== contentGeneration) return
    form.editorType = val
    doSwitch()
  }).catch(() => {})
}

/* ---------- 自动保存（状态机下沉至 composable，规则下沉至 utils） ---------- */
const autosave = useArticleAutosave({
  articleId,
  buildBody: () => ({
    ...buildAutosaveBody(form, currentContent()),
    ...(articleId.value && form.visibility === 'PASSWORD' && form.accessPassword ? { accessPassword: form.accessPassword } : {})
  }),
  saveRemote: async (id, body) => {
    if (conflicted.value) throw Object.assign(new Error('编辑冲突'), { code: '40901' })
    const context = captureContext()
    // Only our own successful writes advance this token, including queued teardown saves.
    const data = await autosaveArticle(id, { ...body, editRevision: editRevision.value })
    if (context.id === id && context.generation === documentGeneration) receiveRevision(data)
    return { savedAt: data.workingCopyUpdatedAt ? new Date(data.workingCopyUpdatedAt).getTime() : Date.now() }
  },
  onError: handleSaveError
})
const autosaveTip = computed(() => !articleId.value && form.accessPassword
  ? '正文草稿可保存到本地；访问口令需正式保存'
  : autosave.tip.value)

function receiveRevision(data) {
  if (!data || data.editRevision == null) throw new Error('文章工作区缺少修订号，请重新加载')
  editRevision.value = data.editRevision
  if (!active) return
  hasWorkingCopy.value = !!data.hasWorkingCopy
  workingCopyUpdatedAt.value = data.workingCopyUpdatedAt || null
  activeStatus.value = data.activeStatus || data.status || 'DRAFT'
  activePublishTime.value = data.activePublishTime || null
  if (data.visibility === form.visibility && data.passwordConfigured != null) form.hasAccessPassword = data.passwordConfigured
}

function handleSaveError(error) {
  if (active && String(error.code) === '40901') conflicted.value = true
}

async function protectDraft() {
  if (saving.value) return false
  if (await autosave.flush()) return true
  try {
    await ElMessageBox.confirm('草稿未能保存，离开将丢失未保存的修改，仍要离开？', '未保存的修改', {
      type: 'warning', confirmButtonText: '仍然离开', cancelButtonText: '继续编辑'
    })
    autosave.markClean()
    return true
  } catch { return false }
}
onBeforeRouteUpdate(protectDraft)
onBeforeRouteLeave(protectDraft)

// 服务端回填在 nextTick 后标记干净，真实编辑才进入自动保存队列。
watch(
  [() => form.title, () => form.summary, () => form.slug, () => form.cover, () => form.categoryId,
    () => [...form.tagIds], () => form.visibility, () => form.accessPassword, () => form.editorType, mdContent, htmlContent],
  autosave.notifyChanged
)

function beforeUnload(event) {
  if (autosave.dirty.value || saving.value) { event.preventDefault(); event.returnValue = '' }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

function fillDraft(draft) {
  invalidateUploads()
  const { content, ...formPatch } = draftToFormPatch(draft)
  Object.assign(form, formPatch)
  if (content !== undefined) {
    if (form.editorType === 'MARKDOWN') mdContent.value = content
    else htmlContent.value = content
  }
}

/* ---------- 保存 ---------- */
function currentContent() {
  return form.editorType === 'MARKDOWN' ? mdContent.value : htmlContent.value
}

async function onSave(status, publishTime) {
  if (!active || pageLoading.value || loadFailed.value || saving.value || conflicted.value) return
  const context = captureContext()
  const content = currentContent()
  const v = validateArticle(form, content)
  if (!v.ok) {
    ElMessage.warning(v.message)
    return
  }
  saving.value = true
  try {
    // 正式保存必须排在自动保存之后，防止旧草稿在服务端清场后才写入。
    if (!await autosave.flush()) return
    if (!ownsContext(context)) return
    const body = {
      title: form.title.trim(),
      content,
      editorType: form.editorType,
      summary: form.summary,
      // slug 固定链接： trim 后随保存提交；留空新建自动生成 / 编辑保持现状（后端口径）
      slug: form.slug.trim(),
      cover: form.cover,
      categoryId: form.categoryId || null,
      tagIds: form.tagIds,
      visibility: form.visibility,
      ...(form.visibility === 'PASSWORD' && form.accessPassword ? { accessPassword: form.accessPassword } : {}),
      status: articleId.value && status !== 'PUBLISHED' ? activeStatus.value : status,
      ...(articleId.value ? { editRevision: editRevision.value } : {})
    }
    // 定时发布：仅在发布且选择了未来时间时携带（草稿忽略）
    if (status === 'PUBLISHED' && publishTime && !isPublished.value) body.publishTime = publishTime
    let newId = null
    const wasPublished = isPublished.value
    if (articleId.value) {
      const data = status === 'PUBLISHED'
        ? await publishArticle(context.id, body)
        : await updateArticle(context.id, body)
      if (!ownsContext(context)) return
      fillArticle(data)
    } else {
      // 后端 POST /articles 的 data 直接是新建文章 id（Long），不是对象
      newId = await createArticle(body)
      if (!ownsContext(context)) return
    }
    // 服务端会自删 autosave；本地清 localStorage 草稿与未保存标记
    form.hasAccessPassword = form.visibility === 'PASSWORD'
    form.accessPassword = ''
    await nextTick()
    autosave.clearDraft()
    publishDialogVisible.value = false
    ElMessage.success(
      status === 'PUBLISHED'
        ? (wasPublished ? '更新发布成功' : publishTime ? '已设置定时发布' : '发布成功')
        : wasPublished ? '修改草稿已保存' : '草稿已保存'
    )
    if (newId) {
      // 先清场、退出 saving，再导航；路由守卫不会重复保存本地草稿。
      saving.value = false
      await router.replace(`/editor/${newId}`)
    }
  } catch (error) { handleSaveError(error) } finally {
    if (ownsContext(context)) saving.value = false
  }
}

/* ---------- 发布弹窗（立即/定时） ---------- */
const publishDialogVisible = ref(false)
const publishMode = ref('now')
const publishTime = ref(null)

async function openPublishDialog() {
  const context = captureContext()
  if (isPublished.value) {
    try {
      await ElMessageBox.confirm(`更新发布会替换生效内容${isScheduled.value ? '，并保留当前定时发布计划' : '，发布时间保持不变'}。确认继续？`,
        '更新发布', { type: 'warning', confirmButtonText: '确认更新', cancelButtonText: '取消' })
    } catch { return }
    if (ownsContext(context)) onSave('PUBLISHED')
    return
  }
  publishMode.value = 'now'
  publishTime.value = null
  publishDialogVisible.value = true
}

// 禁选今天以前的日期；具体时刻在确认时校验
function disabledPublishDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function confirmPublish() {
  if (publishMode.value === 'schedule') {
    const v = validatePublishTime(publishTime.value)
    if (!v.ok) {
      ElMessage.warning(v.message)
      return
    }
    onSave('PUBLISHED', formatLocalDateTime(publishTime.value))
  } else {
    onSave('PUBLISHED')
  }
}

/* ---------- 封面：附件库选择 ---------- */
const pickerVisible = ref(false)

function onPickCover(url) {
  form.cover = url
}

/* ---------- 导入 / 导出（issue #16）---------- */
// 导入创建新草稿并跳到其编辑页（当前编辑内容由自动保存/本地草稿链路保护）；
// 批量导入结果无单篇可跳，回我的文章列表看草稿清单
const importInput = ref(null)
const { importing, handleFile: handleImportFile } = useArticleImport({
  onImported: item => active && router.push(`/editor/${item.id}`),
  onBatchDone: () => active && router.push({ name: 'my-articles' })
})

function triggerImport() {
  importInput.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  await handleImportFile(file)
}

// 导出当前文章（仅已保存）：格式按编辑器类型（MARKDOWN→md / RICHTEXT→html）
const exporting = ref(false)

async function onExport() {
  exporting.value = true
  try {
    await exportArticle(articleId.value, form.editorType === 'RICHTEXT' ? 'html' : 'md')
  } catch { /* 拦截器已提示 */ } finally {
    exporting.value = false
  }
}

/* ---------- 历史版本 ---------- */
const historyVisible = ref(false)

async function applySaved(data) {
  fillArticle(data)
  await nextTick()
  autosave.markClean()
}

async function restoreVersion(version) {
  if (!active || saving.value || conflicted.value) return
  const context = captureContext()
  try {
    await ElMessageBox.confirm(`确认恢复到版本 v${version}？${isPublished.value ? '恢复内容将作为修改草稿，线上版本保持不变。' : '这会替换当前草稿内容。'}`,
      '恢复版本', { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' })
  } catch { return }
  if (!ownsContext(context)) return
  saving.value = true
  try {
    if (!await autosave.flush() || !ownsContext(context)) return
    const data = await restoreArticleVersion(context.id, version, editRevision.value)
    if (!ownsContext(context)) return
    await applySaved(data)
    historyVisible.value = false
    ElMessage.success(isPublished.value ? '历史版本已恢复为修改草稿' : '历史版本已恢复')
  } catch (error) { handleSaveError(error) }
  finally { if (ownsContext(context)) saving.value = false }
}

async function discardWorkingCopy() {
  if (!active || saving.value || conflicted.value) return
  const context = captureContext()
  try {
    await ElMessageBox.confirm('放弃修改会移除工作稿及当前未保存的编辑，已生效的文章内容保持不变。', '放弃修改',
      { type: 'warning', confirmButtonText: '确认放弃', cancelButtonText: '继续编辑' })
  } catch { return }
  if (!ownsContext(context)) return
  saving.value = true
  try {
    await autosave.settle()
    if (!ownsContext(context) || conflicted.value) return
    const data = await discardArticleWorkingCopy(context.id, editRevision.value)
    if (!ownsContext(context)) return
    await applySaved(data)
    ElMessage.success('已放弃修改，生效内容保持不变')
  } catch (error) { handleSaveError(error) }
  finally { if (ownsContext(context)) saving.value = false }
}

async function previewWorkingCopy() {
  if (!active || saving.value || conflicted.value) return
  const context = captureContext()
  saving.value = true
  try {
    if (!await autosave.flush() || !ownsContext(context)) return
    const data = await getArticleEditing(context.id)
    if (!ownsContext(context)) return
    if (data.editRevision !== editRevision.value) { conflicted.value = true; return }
    preview.value = data
    previewVisible.value = true
  } catch (error) { handleSaveError(error) }
  finally { if (ownsContext(context)) saving.value = false }
}

async function compareLatest() {
  if (!active || comparing.value) return
  const context = captureContext()
  comparing.value = true
  try {
    const data = await getArticleEditing(context.id)
    if (ownsContext(context)) { comparison.value = data; comparisonVisible.value = true }
  } catch { /* 拦截器已提示，保留本地修改 */ }
  finally { if (ownsContext(context)) comparing.value = false }
}

async function reloadLatest() {
  if (!active || saving.value) return
  const context = captureContext()
  try {
    await ElMessageBox.confirm('重新加载会替换本地修改，请先复制需要保留的内容。', '重新加载最新稿',
      { type: 'warning', confirmButtonText: '放弃本地修改', cancelButtonText: '继续编辑' })
  } catch { return }
  if (!ownsContext(context)) return
  saving.value = true
  try {
    await autosave.settle()
    if (!ownsContext(context)) return
    const data = await getArticleEditing(context.id)
    if (!ownsContext(context)) return
    await applySaved(data)
    conflicted.value = false
    comparisonVisible.value = false
  } catch { /* 保留现有表单 */ }
  finally { if (ownsContext(context)) saving.value = false }
}

function fillArticle(a) {
  invalidateUploads()
  receiveRevision(a)
  const s = articleToFormState(a)
  form.title = s.title
  form.summary = s.summary
  form.slug = s.slug
  form.cover = s.cover
  form.categoryId = s.categoryId
  form.tagIds = s.tagIds
  form.editorType = s.editorType
  form.visibility = s.visibility
  form.hasAccessPassword = s.hasAccessPassword
  form.accessPassword = ''
  prevEditorType.value = form.editorType
  modeLocked.value = true
  // 同时清空未使用的正文槽位，避免保留其他编辑模式的旧内容。
  mdContent.value = s.mdContent || ''
  htmlContent.value = s.htmlContent || ''
}

// A replacement document must not receive callbacks belonging to discarded content.
function invalidateUploads() {
  contentGeneration++
  coverUploadSequence++
  coverUploading.value = false
}

/* ---------- 初始化 ---------- */
function formatDate(value) { return value ? String(value).replace('T', ' ').slice(0, 16) : '' }

async function loadExisting() {
  documentGeneration++
  const context = captureContext()
  pageLoading.value = true
  loadFailed.value = false
  let recoveredLegacy = false
  try {
    const a = await getArticleEditing(context.id)
    if (!ownsContext(context)) return
    if (!canEditArticle(auth.user, a)) {
      ElMessage.warning('只能编辑自己的文章')
      router.replace({ name: 'my-articles' })
      return
    }
    fillArticle(a)
    // Existing Redis drafts have no concurrency token: offer explicit recovery only when no durable work exists.
    if (!a.hasWorkingCopy) {
      try {
        const draft = await getAutosave(context.id)
        if (!ownsContext(context)) return
        if (shouldOfferServerDraft(draft, a.updateTime)) {
          await ElMessageBox.confirm(`检测到旧自动保存草稿（${formatClock(draft.savedAt)}），恢复到当前编辑？线上内容不会改变。`,
            '恢复草稿', { type: 'info', confirmButtonText: '恢复', cancelButtonText: '不恢复' })
            .then(() => { if (ownsContext(context)) { fillDraft(draft); recoveredLegacy = true } }).catch(() => {})
        }
      } catch { /* 旧缓存不可用不影响已加载的持久工作区 */ }
    }
  } catch { if (ownsContext(context)) loadFailed.value = true }
  finally {
    await nextTick()
    if (ownsContext(context)) {
      pageLoading.value = false
      autosave.markClean()
      autosave.markInitialized()
      if (recoveredLegacy) autosave.notifyChanged()
    }
  }
}

onMounted(async () => {
  listCategories().then(d => { categories.value = d || [] }).catch(() => {})
  listTags().then(d => { tags.value = d || [] }).catch(() => {})

  if (!articleId.value) {
    // 新文章：检测 localStorage 草稿（缺失/损坏直接忽略）
    const draft = parseLocalDraft(localStorage.getItem(DRAFT_NEW_KEY))
    if (draft) {
      await ElMessageBox.confirm(
        `检测到本地草稿（${draft.savedAt ? formatClock(draft.savedAt) : '未知时间'}），恢复？`,
        '恢复草稿',
        { type: 'info', confirmButtonText: '恢复', cancelButtonText: '不恢复' }
      ).then(() => { if (active) fillDraft(draft) }).catch(() => {
        if (active) localStorage.removeItem(DRAFT_NEW_KEY)
      })
    }
    await nextTick()
    if (!active) return
    pageLoading.value = false
    autosave.markInitialized()
    return
  }
  await loadExisting()
})
</script>

<style scoped>
.editor-page {
  width: 100%;
  max-width: 960px;
  min-width: 0;
  margin: 0 auto;
}
.editor-page :deep(.el-form-item__content) {
  min-width: 0;
}
.row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.row-item {
  flex: 1 1 220px;
  min-width: 0;
}
.full-width {
  width: 100%;
}
.cover-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.cover-preview {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}
.lock-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
.editor-wrap {
  width: 100%;
  min-width: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
.actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.autosave-tip {
  margin-right: auto;
  color: #909399;
  font-size: 12px;
}
.schedule-box {
  margin-top: 14px;
}
.schedule-tip {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
.working-state, .editor-alert { padding: 12px 16px; margin-bottom: 16px; background: #f0f7ff; border-radius: 6px; }
.editor-alert { background: #fff4e5; color: #8a4b08; }
.comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.comparison-grid textarea { width: 100%; min-height: 350px; resize: vertical; box-sizing: border-box; }
.rich-preview { overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .comparison-grid { grid-template-columns: 1fr; }
  .row-item { flex-basis: 100%; }
  .actions { justify-content: flex-start; }
  .autosave-tip { flex-basis: 100%; }
  .lock-tip { margin-left: 0; width: 100%; }
  .editor-page :deep(.el-radio-group) { gap: 4px 12px; }
  .editor-page :deep(.el-radio) { margin-right: 0; max-width: 100%; }
  .editor-page :deep(.el-radio__label) { white-space: normal; }
}
</style>
