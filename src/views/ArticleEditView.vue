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
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import {
  createArticle,
  exportArticle,
  getArticle,
  getAutosave,
  updateArticle
} from '../api/article'
import { listCategories } from '../api/category'
import { listTags } from '../api/tag'
import { resolveUploadUrl, uploadAndResolveUrl, uploadImage } from '../api/upload'
import { useAuthStore } from '../stores/auth'
import AttachmentPicker from '../components/AttachmentPicker.vue'
import RichEditor from '../components/RichEditor.vue'
import VersionHistoryDrawer from '../components/VersionHistoryDrawer.vue'
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

const articleId = computed(() => route.params.id || null)
const modeLocked = ref(false)
const pageLoading = ref(false)
const saving = ref(false)
const coverUploading = ref(false)

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
  try {
    const urls = await Promise.all(files.map(f => uploadAndResolveUrl(f)))
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
  const doSwitch = () => {
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
    form.editorType = val
    doSwitch()
  }).catch(() => {})
}

/* ---------- 自动保存（状态机下沉至 composable，规则下沉至 utils） ---------- */
const autosave = useArticleAutosave({
  articleId,
  buildBody: () => buildAutosaveBody(form, currentContent())
})
const autosaveTip = autosave.tip

// 初始填充（onMounted）不触发计时；版本恢复 reloadArticle→fillArticle 的回填会触发，
// 由 reloadArticle 在回填后调 autosave.markClean() 复位（useArticleAutosave.spec 行为锁锁定）
watch(
  [() => form.title, () => form.summary, () => form.cover, () => form.categoryId, () => form.visibility, mdContent, htmlContent],
  autosave.notifyChanged
)

function fillDraft(draft) {
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
  const content = currentContent()
  const v = validateArticle(form, content)
  if (!v.ok) {
    ElMessage.warning(v.message)
    return
  }
  saving.value = true
  try {
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
    form.hasAccessPassword = form.visibility === 'PASSWORD'
    form.accessPassword = ''
    autosave.clearDraft()
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
  onImported: item => router.push(`/editor/${item.id}`),
  onBatchDone: () => router.push({ name: 'my-articles' })
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

async function reloadArticle() {
  // 恢复版本成功后重新拉取文章填表单（服务端恢复前已对当前行留快照）
  try {
    const a = await getArticle(articleId.value)
    fillArticle(a)
    // 回填触发的 watch → notifyChanged 在下一 tick 才执行；等它跑完再复位状态机：
    // 恢复版本不是"未保存的修改"，不应重新计时自动保存（之后的真实编辑仍正常计时）
    await nextTick()
    autosave.markClean()
  } catch { /* 拦截器已提示 */ }
}

function fillArticle(a) {
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
  // 正文槽位：articleToFormState 按原始 a.editorType 路由，未命中槽位为 null 不动
  if (s.mdContent != null) mdContent.value = s.mdContent
  else htmlContent.value = s.htmlContent
}

/* ---------- 初始化 ---------- */
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
      ).then(() => fillDraft(draft)).catch(() => {
        localStorage.removeItem(DRAFT_NEW_KEY)
      })
    }
    autosave.markInitialized()
    return
  }
  pageLoading.value = true
  try {
    const a = await getArticle(articleId.value)
    // 编辑他人文章提前拦截（后端保存时也会拒绝，这里避免加载出完整内容）
    if (!auth.isAdmin && String(a.author?.id) !== String(auth.user?.id)) {
      ElMessage.warning('只能编辑自己的文章')
      router.replace({ name: 'my-articles' })
      return
    }
    fillArticle(a)
    // 服务端自动保存草稿：savedAt 晚于文章 updateTime 时提示恢复
    try {
      const draft = await getAutosave(articleId.value)
      if (shouldOfferServerDraft(draft, a.updateTime)) {
        await ElMessageBox.confirm(
          `检测到自动保存草稿（${formatClock(draft.savedAt)}），恢复？`,
          '恢复草稿',
          { type: 'info', confirmButtonText: '恢复', cancelButtonText: '不恢复' }
        ).then(() => fillDraft(draft)).catch(() => {})
      }
    } catch { /* 拦截器已提示 */ }
  } catch { /* 拦截器已提示 */ } finally {
    pageLoading.value = false
    autosave.markInitialized()
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
