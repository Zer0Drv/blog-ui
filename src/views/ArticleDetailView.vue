<template>
  <div class="detail" :class="{ 'with-toc': hasToc }">
    <el-skeleton v-if="loading" :rows="10" animated />
    <el-card v-else-if="article?.passwordRequired" class="password-gate">
      <h1>这篇文章需要访问口令</h1>
      <p>请输入作者提供的口令以阅读全文。</p>
      <form @submit.prevent="unlockArticle">
        <el-input v-model="accessPassword" type="password" show-password maxlength="64"
          autocomplete="off" aria-label="访问口令" placeholder="请输入访问口令" />
        <CaptchaInput v-if="captchaRequired" ref="captchaRef" v-model="captcha" scene="article-password" />
        <el-button native-type="submit" type="primary" :loading="unlocking">解锁文章</el-button>
      </form>
    </el-card>
    <template v-else-if="article">
      <div class="content-wrap">
        <div class="main-col">
          <el-card class="reading-card" :class="{ 'reading-dark': readingTheme === 'dark' }">
        <h1 class="title">{{ article.title }}</h1>
        <div class="meta">
          <span
            class="author clickable"
            @click="article.author?.id && router.push(`/users/${article.author.id}`)"
          >{{ article.author?.nickname || article.author?.username }}</span>
          <!-- M4 关注按钮：登录且非本人显示 -->
          <el-button
            v-if="showFollow"
            size="small"
            :type="authorFollowed ? 'default' : 'primary'"
            :plain="!!authorFollowed"
            round
            :loading="followLoading"
            @click="toggleFollowAuthor"
          >{{ authorFollowed ? '已关注' : '+ 关注' }}</el-button>
          <span>发布于 {{ formatTime(article.publishTime || article.createTime) }}</span>
          <el-tag v-if="article.categoryName" size="small" type="info">{{ article.categoryName }}</el-tag>
          <el-tag
            v-for="t in article.tags || []"
            :key="t.id"
            size="small"
            class="tag"
          >{{ t.name }}</el-tag>
          <template v-if="canManage">
            <el-tag size="small" :type="statusType(article.status)">{{ statusText(article.status) }}</el-tag>
            <el-button size="small" type="primary" link @click="router.push(`/editor/${article.id}`)">
              编辑
            </el-button>
          </template>
          <!-- 导出：公开文章任何人可导出（契约同详情可见性），格式按编辑器类型 -->
          <el-button v-if="canManage || article.visibility === 'PUBLIC' || !article.visibility" size="small" link :loading="exporting" @click="onExport">导出</el-button>
        </div>
        <img v-if="article.cover" :src="resolveUploadUrl(article.cover)" class="cover" alt="cover" />
        <el-divider />
        <div class="reading-tools">
          <span>预计阅读 {{ minutes }} 分钟</span>
          <label class="progress-label">
            <span>阅读进度 {{ progress }}%</span>
            <progress :value="progress" max="100" aria-label="阅读进度" />
          </label>
          <el-button v-if="resume !== null" size="small" @click="continueReading">继续上次阅读</el-button>
          <details>
            <summary>阅读设置</summary>
            <div class="reading-options">
              <label>主题
                <select v-model="preferences.theme">
                  <option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option>
                </select>
              </label>
              <label>字号
                <select v-model="preferences.size">
                  <option value="small">较小</option><option value="normal">标准</option><option value="large">较大</option>
                </select>
              </label>
              <label>行距
                <select v-model="preferences.spacing">
                  <option value="normal">标准</option><option value="relaxed">宽松</option>
                </select>
              </label>
            </div>
          </details>
        </div>
        <div ref="readingBody" class="reading-body" tabindex="-1" :class="[`reading-size-${preferences.size}`, `reading-spacing-${preferences.spacing}`]">
        <!-- 渲染前统一 DOMPurify 消毒（#9 存储型 XSS 防护，sanitize 收口于 MdContentPreview） -->
        <MdContentPreview
          v-if="article.editorType === 'MARKDOWN'"
          :content="article.content || ''"
          :editor-id="previewId"
          :theme="readingTheme"
          @get-catalog="onGetCatalog"
        />
        <!-- RICHTEXT 模式渲染消毒后的 HTML（<script>/on* 事件等已被移除） -->
        <div v-else ref="richtextRef" class="richtext" v-html="sanitizedContent" />
        </div>

        <!-- M3 互动栏：浏览量/点赞/收藏/评论数 -->
        <div v-if="!article.visibility || article.visibility === 'PUBLIC'" class="interaction-bar">
          <span class="stat">
            <el-icon><View /></el-icon>
            {{ article.viewCount || 0 }} 浏览
          </span>
          <el-button
            :type="article.liked ? 'primary' : 'default'"
            :plain="!article.liked"
            round
            :loading="liking"
            @click="toggleLike"
          >
            <el-icon><Pointer /></el-icon>
            {{ article.liked ? '已点赞' : '点赞' }} {{ article.likeCount || 0 }}
          </el-button>
          <el-button
            :type="article.favorited ? 'warning' : 'default'"
            :plain="!article.favorited"
            round
            :loading="favoriting"
            @click="toggleFavorite"
          >
            <el-icon><Star /></el-icon>
            {{ article.favorited ? '已收藏' : '收藏' }} {{ article.favoriteCount || 0 }}
          </el-button>
          <span class="stat">
            <el-icon><ChatDotRound /></el-icon>
            {{ article.commentCount || 0 }} 评论
          </span>
        </div>
      </el-card>

          <ArticleSeriesNavigation v-if="article.visible === true" :key="article.id" :article-id="article.id" />
          <CommentSection v-if="!article.visibility || article.visibility === 'PUBLIC'" :article-id="article.id" @change="onCommentChange" />
        </div>

        <!-- P0 目录：宽屏（≥1100px）右侧 sticky，窄屏由 CSS order 收起到正文上方；无标题不渲染 -->
        <aside v-if="hasToc" class="toc-aside">
          <div class="toc-box" :class="{ 'reading-dark': readingTheme === 'dark' }">
            <div class="toc-title">目录</div>
            <!-- MARKDOWN：MdCatalog 通过 editorId 与页内 MdContentPreview 联动，默认文档滚动 -->
            <MdCatalog v-if="isMarkdown" :editor-id="previewId" :theme="readingTheme" :scroll-element-offset-top="70" />
            <!-- 富文本：渲染完成后从正文提取 h2/h3（≤20 条），点击平滑滚动 -->
            <ul v-else class="toc-list">
              <li
                v-for="item in tocItems"
                :key="item.id"
                :class="`toc-lv-${item.level}`"
              >
                <a class="toc-link" :href="`#${item.id}`" @click.prevent="scrollToHeading(item)">{{ item.text }}</a>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </template>
    <el-empty v-else description="文章不存在或已删除" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdCatalog } from 'md-editor-v3'
import { ElMessage } from 'element-plus'
import { View, Pointer, Star, ChatDotRound } from '@element-plus/icons-vue'
import { getArticle, getArticleBySlug, exportArticle, verifyArticlePassword } from '../api/article'
import { likeArticle, unlikeArticle, favoriteArticle, unfavoriteArticle } from '../api/interaction'
import { follow, unfollow, getUserProfile } from '../api/social'
import { resolveUploadUrl } from '../api/upload'
import { sanitizeHtml } from '../utils/sanitize'
import { useAuthStore } from '../stores/auth'
import { useDocumentTitle } from '../composables/useDocumentTitle'
import { readingMinutes, useArticleReading } from '../composables/useArticleReading'
import { loadArticleMetadata } from '../utils/articleMetadata'
import CommentSection from '../components/CommentSection.vue'
import MdContentPreview from '../components/MdContentPreview.vue'
import CaptchaInput from '../components/CaptchaInput.vue'
import ArticleSeriesNavigation from '../components/ArticleSeriesNavigation.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 页签标题：文章加载完成后覆盖为文章标题，离开页面自动恢复路由标题
const { setTitle } = useDocumentTitle()

const article = ref(null)
const readingBody = ref(null)
const { preferences, theme: readingTheme, progress, resume, continueReading, updateLayout } =
  useArticleReading(article, readingBody)
const loading = ref(true)
// slug 固定链接路由（Zer0Drv/blog#14）与 id 路由共用本组件：按路由参数分流取数
const previewId = computed(() => `preview-${route.params.id || route.params.slug}`)
const accessPassword = ref('')
const accessToken = ref('')
const unlocking = ref(false)
const captchaRequired = ref(false)
const captchaRef = ref(null)
const captcha = ref({ captchaId: '', captchaCode: '' })
// 令牌仅驻留当前页面内存，离开或切换文章即清除。
let loadSequence = 0

async function unlockArticle() {
  if (!accessPassword.value) { ElMessage.warning('请输入访问口令'); return }
  const sequence = loadSequence
  unlocking.value = true
  try {
    const grant = await verifyArticlePassword(article.value.id, { password: accessPassword.value, ...captcha.value })
    if (sequence !== loadSequence) return
    accessToken.value = grant.accessToken
    accessPassword.value = ''
    await loadArticle()
  } catch (e) {
    if (sequence !== loadSequence) return
    if (String(e.code) === '40066') captchaRequired.value = true
    captchaRef.value?.refresh()
  } finally { unlocking.value = false }
}

// #9：RICHTEXT 正文渲染前经 DOMPurify 消毒，杜绝 <img onerror> / <script> 等存储型 XSS
const sanitizedContent = computed(() => sanitizeHtml(article.value?.content || ''))
const minutes = computed(() => {
  if (article.value?.editorType === 'MARKDOWN') {
    return readingMinutes((article.value?.content || '').replace(/\[([^\[\]\r\n]*)\]\([^)\r\n]*\)/g, '$1'))
  }
  const template = document.createElement('template')
  template.innerHTML = sanitizedContent.value
  return readingMinutes(template.content.textContent || '')
})

const canManage = computed(() => {
  if (!auth.user || !article.value) return false
  return auth.isAdmin ||
    (auth.canWrite && auth.user.id === article.value.author?.id)
})

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

function statusText(s) {
  return { DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下架' }[s] || s
}

function statusType(s) {
  return { DRAFT: 'info', PUBLISHED: 'success', OFFLINE: 'warning' }[s] || 'info'
}

// 导出：MARKDOWN→md，RICHTEXT→html；文件名由后端 Content-Disposition 提供
const exporting = ref(false)

async function onExport() {
  if (!article.value) return
  exporting.value = true
  try {
    await exportArticle(article.value.id, article.value.editorType === 'MARKDOWN' ? 'md' : 'html')
  } catch { /* 拦截器已提示 */ } finally {
    exporting.value = false
  }
}

// P0 文章目录（TOC）：MARKDOWN 走 MdCatalog（onGetCatalog 判空），富文本自行提取 h2/h3
const isMarkdown = computed(() => article.value?.editorType === 'MARKDOWN')
const mdCatalogList = ref([])
const tocItems = ref([])
const richtextRef = ref(null)
const hasToc = computed(() =>
  isMarkdown.value ? mdCatalogList.value.length > 0 : tocItems.value.length > 0)

// MdContentPreview 渲染完成后吐出标题列表；为空则不渲染目录块
function onGetCatalog(list) {
  mdCatalogList.value = list || []
  updateLayout()
}

// 富文本目录：从正文容器提取 h2/h3，补 id（toc-0...）供锚点滚动，最多 20 条
function buildRichtextToc() {
  tocItems.value = []
  const root = richtextRef.value
  if (!root) return
  const items = []
  root.querySelectorAll('h2, h3').forEach(h => {
    if (items.length >= 20) return
    const id = `toc-${items.length}`
    h.id = id
    items.push({ id, text: (h.textContent || '').trim(), level: Number(h.tagName.slice(1)) })
  })
  tocItems.value = items
}

function scrollToHeading(item) {
  richtextRef.value?.querySelector(`#${item.id}`)?.scrollIntoView({ behavior: 'smooth' })
}

let appliedAnchor = null
watch([() => route.hash, article], () => { appliedAnchor = null }, { flush: 'sync' })
watch([() => route.hash, readingBody, mdCatalogList, tocItems], async () => {
  const hash = route.hash
  if (!hash || appliedAnchor === hash || !readingBody.value) return
  await nextTick()
  if (hash !== route.hash || appliedAnchor === hash || !readingBody.value) return
  let id
  try { id = decodeURIComponent(hash.slice(1)) } catch { return }
  const target = Array.from(readingBody.value.querySelectorAll('[id]')).find(node => node.id === id)
  if (target) {
    appliedAnchor = hash
    target.scrollIntoView?.()
  }
})

// M3 互动：点赞/收藏（匿名点击跳登录）
const liking = ref(false)
const favoriting = ref(false)

function requireLogin() {
  if (auth.isLoggedIn) return true
  ElMessage.info('请先登录')
  router.push('/login')
  return false
}

async function toggleLike() {
  if (!requireLogin()) return
  liking.value = true
  try {
    if (article.value.liked) {
      await unlikeArticle(article.value.id)
      article.value.liked = false
      article.value.likeCount = Math.max(0, (article.value.likeCount || 0) - 1)
    } else {
      await likeArticle(article.value.id)
      article.value.liked = true
      article.value.likeCount = (article.value.likeCount || 0) + 1
    }
  } catch { /* 拦截器已提示 */ } finally {
    liking.value = false
  }
}

async function toggleFavorite() {
  if (!requireLogin()) return
  favoriting.value = true
  try {
    if (article.value.favorited) {
      await unfavoriteArticle(article.value.id)
      article.value.favorited = false
      article.value.favoriteCount = Math.max(0, (article.value.favoriteCount || 0) - 1)
      ElMessage.success('已取消收藏')
    } else {
      await favoriteArticle(article.value.id)
      article.value.favorited = true
      article.value.favoriteCount = (article.value.favoriteCount || 0) + 1
      ElMessage.success('收藏成功')
    }
  } catch { /* 拦截器已提示 */ } finally {
    favoriting.value = false
  }
}

// 评论区发表/删除评论时同步详情 VO 的评论数
function onCommentChange(delta) {
  if (!article.value) return
  article.value.commentCount = Math.max(0, (article.value.commentCount || 0) + delta)
}

// M4 关注作者：登录且非本人才显示按钮
const authorFollowed = ref(false)
const followLoading = ref(false)
const showFollow = computed(() =>
  auth.isLoggedIn && article.value?.author?.id && auth.user?.id !== article.value.author.id)

async function loadAuthorFollowState() {
  if (!showFollow.value) return
  try {
    const profile = await getUserProfile(article.value.author.id)
    authorFollowed.value = !!Number(profile?.followed)
  } catch { /* 非关键路径，失败仅不显示关注态 */ }
}

async function toggleFollowAuthor() {
  if (!requireLogin()) return
  followLoading.value = true
  try {
    if (authorFollowed.value) {
      await unfollow(article.value.author.id)
      authorFollowed.value = false
      ElMessage.success('已取消关注')
    } else {
      await follow(article.value.author.id)
      authorFollowed.value = true
      ElMessage.success('关注成功')
    }
  } catch { /* 拦截器已提示 */ } finally {
    followLoading.value = false
  }
}

async function loadArticle() {
  void loadArticleMetadata(route.params.slug || route.params.id)
  const sequence = ++loadSequence
  loading.value = true
  article.value = null
  mdCatalogList.value = []
  tocItems.value = []
  setTitle('文章详情')
  try {
    const loaded = route.params.slug
      ? await getArticleBySlug(route.params.slug, accessToken.value)
      : await getArticle(route.params.id, accessToken.value)
    if (sequence !== loadSequence) return
    article.value = loaded
    setTitle(article.value?.passwordRequired ? '文章需要访问口令' : article.value?.title)
    loadAuthorFollowState()
    // 富文本：等 v-html 渲染完成后再提取目录（MARKDOWN 由 MdCatalog 自动联动）
    loading.value = false
    if (article.value && !article.value.passwordRequired && article.value.editorType !== 'MARKDOWN') {
      await nextTick()
      buildRichtextToc()
    }
  } catch { /* 拦截器已提示 */ } finally {
    if (sequence === loadSequence) loading.value = false
  }
}
onMounted(loadArticle)
watch(() => [route.params.id, route.params.slug], () => {
  accessToken.value = ''
  accessPassword.value = ''
  captchaRequired.value = false
  captcha.value = { captchaId: '', captchaCode: '' }
  loadArticle()
})
</script>

<style scoped>
.password-gate { max-width: 480px; margin: 40px auto; }
.password-gate h1 { font-size: 22px; }
.password-gate form { display: grid; gap: 16px; }
.detail {
  max-width: 860px;
  margin: 0 auto;
}
/* 有目录时放宽整页宽度，给右侧目录留位 */
.detail.with-toc {
  max-width: 1120px;
}
.content-wrap {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.main-col {
  flex: 1;
  min-width: 0;
}
.toc-aside {
  width: 240px;
  flex-shrink: 0;
  position: sticky;
  top: 76px;
}
.toc-box {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 14px 16px;
  max-height: calc(100vh - 110px);
  overflow-y: auto;
}
.toc-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 10px;
}
.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.toc-list li {
  margin: 6px 0;
}
.toc-lv-3 {
  padding-left: 14px;
}
.toc-link {
  cursor: pointer;
  color: #606266;
  font-size: 13px;
  line-height: 1.4;
}
.toc-link:hover {
  color: #409eff;
}
/* 窄屏：目录收起到正文上方，取消 sticky */
@media (max-width: 1099px) {
  .content-wrap {
    flex-direction: column;
  }
  .toc-aside {
    order: -1;
    width: 100%;
    position: static;
  }
  .main-col {
    width: 100%;
  }
  .toc-box {
    max-height: 300px;
  }
}
.title {
  margin: 0 0 12px;
  color: #303133;
}
.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #909399;
  font-size: 13px;
  flex-wrap: wrap;
}
.author {
  color: #606266;
  font-weight: 600;
}
.cover {
  max-width: 100%;
  margin-top: 16px;
  border-radius: 4px;
}
.richtext :deep(img) {
  max-width: 100%;
}
.reading-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-bottom: 16px; font-size: .875rem; }
.reading-tools summary { cursor: pointer; }
.progress-label { display: inline-flex; align-items: center; gap: 6px; }
.progress-label progress { width: 75px; accent-color: var(--el-color-primary); }
.reading-options { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 0; }
.reading-options label { display: grid; gap: 4px; }
.reading-options select { min-height: 32px; font: inherit; color: inherit; background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 4px; }
.reading-body { --reading-size: 1rem; --reading-spacing: 1.7; min-width: 0; overflow-wrap: anywhere; }
.reading-body:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 4px; }
.reading-size-small { --reading-size: .9rem; }
.reading-size-large { --reading-size: 1.2rem; }
.reading-spacing-relaxed { --reading-spacing: 2; }
.reading-body .richtext, .reading-body :deep(.md-editor-preview) { font-size: var(--reading-size); line-height: var(--reading-spacing); }
.reading-body :deep(pre), .reading-body :deep(.katex-display) { max-width: 100%; overflow: auto; }
.reading-body :deep(svg) { max-width: 100%; }
.reading-body .richtext :deep(pre), .reading-body .richtext :deep(blockquote) { background: var(--el-fill-color-light); padding: 8px 12px; }
.reading-body .richtext :deep(table) { max-width: 100%; border-collapse: collapse; }
.reading-body .richtext :deep(td), .reading-body .richtext :deep(th) { border: 1px solid var(--el-border-color); padding: 4px 8px; }
.reading-body .richtext :deep(th) { background: var(--el-fill-color-light); }
.reading-body .richtext :deep(a) { color: var(--el-color-primary); }
.reading-dark {
  color-scheme: dark;
  --el-bg-color: #1c232d;
  --el-bg-color-overlay: #1c232d;
  --el-fill-color-light: #293340;
  --el-border-color: #627183;
  --el-border-color-light: #526071;
  --el-text-color-primary: #f4f6f8;
  --el-text-color-regular: #d3dce6;
  --el-color-primary: #9fcdff;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
.reading-dark .title, .reading-dark .toc-title { color: var(--el-text-color-primary); }
.reading-dark .meta, .reading-dark .author, .reading-dark .toc-link { color: var(--el-text-color-regular); }
.reading-dark .toc-link:hover { color: var(--el-color-primary); }
</style>
