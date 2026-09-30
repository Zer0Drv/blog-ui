<template>
  <div class="editor-page">
    <el-card v-loading="pageLoading">
      <el-form label-position="top">
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
            <template v-else>
              <Toolbar
                class="rt-toolbar"
                :editor="editorRef"
                :default-config="toolbarConfig"
                mode="default"
              />
              <Editor
                v-model="htmlContent"
                class="rt-editor"
                :default-config="editorConfig"
                mode="default"
                @on-created="onEditorCreated"
              />
            </template>
          </div>
        </el-form-item>

        <div class="actions">
          <span v-if="autosaveTip" class="autosave-tip">{{ autosaveTip }}</span>
          <el-button v-if="articleId" @click="historyVisible = true">历史版本</el-button>
          <el-button :loading="saving" @click="onSave('DRAFT')">保存草稿</el-button>
          <el-button type="primary" :loading="saving" @click="openPublishDialog">发布</el-button>
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
      @restored="reloadArticle"
    />

    <!-- 封面附件库选择 -->
    <AttachmentPicker v-model:visible="pickerVisible" @select="onPickCover" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import {
  autosaveArticle,
  createArticle,
  getArticle,
  getAutosave,
  updateArticle
} from '../api/article'
import { listCategories } from '../api/category'
import { listTags } from '../api/tag'
import { resolveUploadUrl, uploadImage } from '../api/upload'
import { useAuthStore } from '../stores/auth'
import AttachmentPicker from '../components/AttachmentPicker.vue'
import VersionHistoryDrawer from '../components/VersionHistoryDrawer.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const articleId = computed(() => route.params.id || null)
const modeLocked = ref(false)
const pageLoading = ref(false)
const saving = ref(false)
const coverUploading = ref(false)

const form = reactive({
  title: '',
  summary: '',
  cover: '',
  categoryId: null,
  tagIds: [],
  editorType: 'MARKDOWN'
})
const mdContent = ref('')
const htmlContent = ref('')
const categories = ref([])
const tags = ref([])

const mdEditorId = `md-editor-${articleId.value || 'new'}`

/* ---------- wangeditor ---------- */
const editorRef = shallowRef()
const toolbarConfig = {}
const editorConfig = {
  placeholder: '请输入正文...',
  MENU_CONF: {
    uploadImage: {
      // 自定义上传：走统一 http 实例（带 token、走 /api 代理）
      async customUpload(file, insertFn) {
        try {
          const data = await uploadImage(file)
          insertFn(resolveUploadUrl(data.url), file.name, resolveUploadUrl(data.url))
        } catch { /* 拦截器已提示 */ }
      }
    }
  }
}

function onEditorCreated(editor) {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  // 卸载前对已存在文章补一次自动保存（新文章草稿已实时落在 localStorage）
  if (autosaveTimer) clearTimeout(autosaveTimer)
  if (dirty.value && articleId.value) {
    const body = buildAutosaveBody()
    if (body) autosaveArticle(articleId.value, body).catch(() => {})
  }
  editorRef.value?.destroy()
  editorRef.value = undefined
})

/* ---------- Markdown 图片上传 ---------- */
async function onMdUploadImg(files, callback) {
  try {
    const urls = await Promise.all(
      files.map(async f => {
        const data = await uploadImage(f)
        return resolveUploadUrl(data.url)
      })
    )
    callback(urls)
  } catch { /* 拦截器已提示 */ }
}

/* ---------- 封面上传 ---------- */
async function onCoverUpload({ file }) {
  coverUploading.value = true
  try {
    const data = await uploadImage(file)
    form.cover = data.url
    ElMessage.success('封面上传成功')
  } catch { /* 拦截器已提示 */ } finally {
    coverUploading.value = false
  }
}

/* ---------- 模式切换 ---------- */
const prevEditorType = ref('MARKDOWN')

function onEditorTypeChange(val) {
  const prev = prevEditorType.value
  const hasContent = prev === 'MARKDOWN'
    ? mdContent.value.trim()
    : htmlContent.value.replace(/<[^>]+>/g, '').trim()
  const doSwitch = () => {
    prevEditorType.value = val
  }
  if (!hasContent) {
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
    form.editorType = val
    doSwitch()
  }).catch(() => {})
}

/* ---------- 自动保存 ---------- */
const DRAFT_NEW_KEY = 'draft:new'
const AUTOSAVE_DELAY = 30 * 1000

const dirty = ref(false)
const lastAutosavedAt = ref('')
const initialized = ref(false)
let autosaveTimer = null

const autosaveTip = computed(() => {
  if (dirty.value) return '有未保存的修改'
  return lastAutosavedAt.value ? `已自动保存 ${lastAutosavedAt.value}` : ''
})

function pad2(n) {
  return String(n).padStart(2, '0')
}

// 本地时间 yyyy-MM-ddTHH:mm:ss（后端 Jackson 默认 ISO 格式）
function formatLocalDateTime(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatClock(t) {
  const d = new Date(Number(t))
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function buildAutosaveBody() {
  const content = currentContent()
  // 正文为空不自动保存（后端 content 非空校验）
  if (!content.replace(/<[^>]+>/g, '').trim()) return null
  return {
    title: form.title.trim(),
    content,
    summary: form.summary,
    cover: form.cover,
    categoryId: form.categoryId || null
  }
}

function scheduleAutosave() {
  // 初始填充/版本恢复不触发自动保存计时
  if (!initialized.value) return
  dirty.value = true
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(doAutosave, AUTOSAVE_DELAY)
}

watch(
  [() => form.title, () => form.summary, () => form.cover, () => form.categoryId, mdContent, htmlContent],
  scheduleAutosave
)

async function doAutosave() {
  if (!dirty.value) return
  const body = buildAutosaveBody()
  if (!body) return
  if (articleId.value) {
    try {
      const data = await autosaveArticle(articleId.value, body)
      lastAutosavedAt.value = formatClock(data?.savedAt || Date.now())
      dirty.value = false
    } catch { /* 拦截器已提示 */ }
  } else {
    // 新文章无服务端 autosave，落 localStorage
    localStorage.setItem(DRAFT_NEW_KEY, JSON.stringify({ ...body, savedAt: Date.now() }))
    lastAutosavedAt.value = formatClock(Date.now())
    dirty.value = false
  }
}

function fillDraft(draft) {
  if (draft.title != null) form.title = draft.title
  if (draft.summary != null) form.summary = draft.summary
  if (draft.cover != null) form.cover = draft.cover
  if (draft.categoryId !== undefined) form.categoryId = draft.categoryId || null
  if (draft.content != null) {
    if (form.editorType === 'MARKDOWN') mdContent.value = draft.content
    else htmlContent.value = draft.content
  }
}

function clearDraftMarks() {
  dirty.value = false
  if (autosaveTimer) clearTimeout(autosaveTimer)
  localStorage.removeItem(DRAFT_NEW_KEY)
}

/* ---------- 保存 ---------- */
function currentContent() {
  return form.editorType === 'MARKDOWN' ? mdContent.value : htmlContent.value
}

function validate(content) {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题')
    return false
  }
  const plain = content.replace(/<[^>]+>/g, '').trim()
  if (!plain) {
    ElMessage.warning('正文不能为空')
    return false
  }
  return true
}

async function onSave(status, publishTime) {
  const content = currentContent()
  if (!validate(content)) return
  saving.value = true
  try {
    const body = {
      title: form.title.trim(),
      content,
      editorType: form.editorType,
      summary: form.summary,
      cover: form.cover,
      categoryId: form.categoryId || null,
      tagIds: form.tagIds,
      status
    }
    // 定时发布：仅在发布且选择了未来时间时携带（草稿忽略）
    if (status === 'PUBLISHED' && publishTime) body.publishTime = publishTime
    if (articleId.value) {
      await updateArticle(articleId.value, body)
    } else {
      // 后端 POST /articles 的 data 直接是新建文章 id（Long），不是对象
      const newId = await createArticle(body)
      if (newId) {
        modeLocked.value = true
        router.replace(`/editor/${newId}`)
      }
    }
    // 服务端会自删 autosave；本地清 localStorage 草稿与未保存标记
    clearDraftMarks()
    publishDialogVisible.value = false
    ElMessage.success(
      status === 'PUBLISHED'
        ? (publishTime ? '已设置定时发布' : '发布成功')
        : '草稿已保存'
    )
  } catch { /* 拦截器已提示 */ } finally {
    saving.value = false
  }
}

/* ---------- 发布弹窗（立即/定时） ---------- */
const publishDialogVisible = ref(false)
const publishMode = ref('now')
const publishTime = ref(null)

function openPublishDialog() {
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
    if (!publishTime.value) {
      ElMessage.warning('请选择定时发布时间')
      return
    }
    if (publishTime.value.getTime() <= Date.now() + 5 * 60 * 1000) {
      ElMessage.warning('定时发布时间需晚于当前时间至少 5 分钟')
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

/* ---------- 历史版本 ---------- */
const historyVisible = ref(false)

async function reloadArticle() {
  // 恢复版本成功后重新拉取文章填表单（服务端恢复前已对当前行留快照）
  try {
    const a = await getArticle(articleId.value)
    fillArticle(a)
  } catch { /* 拦截器已提示 */ }
}

function fillArticle(a) {
  form.title = a.title || ''
  form.summary = a.summary || ''
  form.cover = a.cover || ''
  form.categoryId = a.categoryId || null
  form.tagIds = (a.tags || []).map(t => t.id)
  form.editorType = a.editorType || 'MARKDOWN'
  prevEditorType.value = form.editorType
  modeLocked.value = true
  if (a.editorType === 'MARKDOWN') {
    mdContent.value = a.content || ''
  } else {
    htmlContent.value = a.content || ''
  }
}

/* ---------- 初始化 ---------- */
onMounted(async () => {
  listCategories().then(d => { categories.value = d || [] }).catch(() => {})
  listTags().then(d => { tags.value = d || [] }).catch(() => {})

  if (!articleId.value) {
    // 新文章：检测 localStorage 草稿
    const raw = localStorage.getItem(DRAFT_NEW_KEY)
    if (raw) {
      try {
        const draft = JSON.parse(raw)
        await ElMessageBox.confirm(
          `检测到本地草稿（${draft.savedAt ? formatClock(draft.savedAt) : '未知时间'}），恢复？`,
          '恢复草稿',
          { type: 'info', confirmButtonText: '恢复', cancelButtonText: '不恢复' }
        ).then(() => fillDraft(draft)).catch(() => {
          localStorage.removeItem(DRAFT_NEW_KEY)
        })
      } catch { /* 草稿损坏直接忽略 */ }
    }
    initialized.value = true
    return
  }
  pageLoading.value = true
  try {
    const a = await getArticle(articleId.value)
    // 编辑他人文章提前拦截（后端保存时也会拒绝，这里避免加载出完整内容）
    if (auth.user?.role !== 'ADMIN' && String(a.author?.id) !== String(auth.user?.id)) {
      ElMessage.warning('只能编辑自己的文章')
      router.replace({ name: 'my-articles' })
      return
    }
    fillArticle(a)
    // 服务端自动保存草稿：savedAt 晚于文章 updateTime 时提示恢复
    try {
      const draft = await getAutosave(articleId.value)
      const articleTime = a.updateTime ? new Date(String(a.updateTime).replace(' ', 'T')).getTime() : 0
      if (draft?.exists && Number(draft.savedAt) > articleTime) {
        await ElMessageBox.confirm(
          `检测到自动保存草稿（${formatClock(draft.savedAt)}），恢复？`,
          '恢复草稿',
          { type: 'info', confirmButtonText: '恢复', cancelButtonText: '不恢复' }
        ).then(() => fillDraft(draft)).catch(() => {})
      }
    } catch { /* 拦截器已提示 */ }
  } catch { /* 拦截器已提示 */ } finally {
    pageLoading.value = false
    initialized.value = true
  }
})
</script>

<style scoped>
.editor-page {
  max-width: 960px;
  margin: 0 auto;
}
.row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.row-item {
  flex: 1;
  min-width: 220px;
}
.full-width {
  width: 100%;
}
.cover-box {
  display: flex;
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
}
.rt-toolbar {
  border-bottom: 1px solid #e4e7ed;
}
.rt-editor {
  height: 480px !important;
  overflow-y: hidden;
}
.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
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
</style>
