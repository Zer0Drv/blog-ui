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
          <el-button :loading="saving" @click="onSave('DRAFT')">保存草稿</el-button>
          <el-button type="primary" :loading="saving" @click="onSave('PUBLISHED')">发布</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { createArticle, getArticle, updateArticle } from '../api/article'
import { listCategories } from '../api/category'
import { listTags } from '../api/tag'
import { resolveUploadUrl, uploadImage } from '../api/upload'

const route = useRoute()
const router = useRouter()

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

async function onSave(status) {
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
    ElMessage.success(status === 'PUBLISHED' ? '发布成功' : '草稿已保存')
  } catch { /* 拦截器已提示 */ } finally {
    saving.value = false
  }
}

/* ---------- 初始化 ---------- */
onMounted(async () => {
  listCategories().then(d => { categories.value = d || [] }).catch(() => {})
  listTags().then(d => { tags.value = d || [] }).catch(() => {})

  if (!articleId.value) return
  pageLoading.value = true
  try {
    const a = await getArticle(articleId.value)
    // 编辑他人文章提前拦截（后端保存时也会拒绝，这里避免加载出完整内容）
    if (auth.user?.role !== 'ADMIN' && String(a.author?.id) !== String(auth.user?.id)) {
      ElMessage.warning('只能编辑自己的文章')
      router.replace({ name: 'my-articles' })
      return
    }
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
  } catch { /* 拦截器已提示 */ } finally {
    pageLoading.value = false
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
  gap: 12px;
}
</style>
