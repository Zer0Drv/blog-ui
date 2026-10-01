<template>
  <div class="detail" :class="{ 'with-toc': hasToc }">
    <el-skeleton v-if="loading" :rows="10" animated />
    <template v-else-if="article">
      <div class="content-wrap">
        <div class="main-col">
          <el-card>
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
        </div>
        <img v-if="article.cover" :src="resolveUploadUrl(article.cover)" class="cover" alt="cover" />
        <el-divider />
        <!-- 渲染前统一 DOMPurify 消毒（#9 存储型 XSS 防护） -->
        <MdPreview
          v-if="article.editorType === 'MARKDOWN'"
          :model-value="article.content || ''"
          :editor-id="previewId"
          :sanitize="sanitizeHtml"
          @on-get-catalog="onGetCatalog"
        />
        <!-- RICHTEXT 模式渲染消毒后的 HTML（<script>/on* 事件等已被移除） -->
        <div v-else ref="richtextRef" class="richtext" v-html="sanitizedContent" />

        <!-- M3 互动栏：浏览量/点赞/收藏/评论数 -->
        <div class="interaction-bar">
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

          <CommentSection :article-id="article.id" @change="onCommentChange" />
        </div>

        <!-- P0 目录：宽屏（≥1100px）右侧 sticky，窄屏由 CSS order 收起到正文上方；无标题不渲染 -->
        <aside v-if="hasToc" class="toc-aside">
          <div class="toc-box">
            <div class="toc-title">目录</div>
            <!-- MARKDOWN：MdCatalog 通过 editorId 与页内 MdPreview 联动，默认文档滚动 -->
            <MdCatalog v-if="isMarkdown" :editor-id="previewId" :scroll-element-offset-top="70" />
            <!-- 富文本：渲染完成后从正文提取 h2/h3（≤20 条），点击平滑滚动 -->
            <ul v-else class="toc-list">
              <li
                v-for="item in tocItems"
                :key="item.id"
                :class="`toc-lv-${item.level}`"
              >
                <a class="toc-link" @click="scrollToHeading(item)">{{ item.text }}</a>
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
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdPreview, MdCatalog } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { ElMessage } from 'element-plus'
import { View, Pointer, Star, ChatDotRound } from '@element-plus/icons-vue'
import { getArticle } from '../api/article'
import { likeArticle, unlikeArticle, favoriteArticle, unfavoriteArticle } from '../api/interaction'
import { follow, unfollow, getUserProfile } from '../api/social'
import { resolveUploadUrl } from '../api/upload'
import { sanitizeHtml } from '../utils/sanitize'
import { useAuthStore } from '../stores/auth'
import CommentSection from '../components/CommentSection.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const article = ref(null)
const loading = ref(true)
const previewId = `preview-${route.params.id}`

// #9：RICHTEXT 正文渲染前经 DOMPurify 消毒，杜绝 <img onerror> / <script> 等存储型 XSS
const sanitizedContent = computed(() => sanitizeHtml(article.value?.content || ''))

const canManage = computed(() => {
  if (!auth.user || !article.value) return false
  return auth.user.role === 'ADMIN' ||
    (['ADMIN', 'AUTHOR'].includes(auth.user.role) && auth.user.id === article.value.author?.id)
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

// P0 文章目录（TOC）：MARKDOWN 走 MdCatalog（onGetCatalog 判空），富文本自行提取 h2/h3
const isMarkdown = computed(() => article.value?.editorType === 'MARKDOWN')
const mdCatalogList = ref([])
const tocItems = ref([])
const richtextRef = ref(null)
const hasToc = computed(() =>
  isMarkdown.value ? mdCatalogList.value.length > 0 : tocItems.value.length > 0)

// MdPreview 渲染完成后吐出标题列表；为空则不渲染目录块
function onGetCatalog(list) {
  mdCatalogList.value = list || []
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
  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
}

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

onMounted(async () => {
  if (auth.isLoggedIn && !auth.user) {
    try { await auth.fetchMe() } catch { /* 忽略 */ }
  }
  try {
    article.value = await getArticle(route.params.id)
    loadAuthorFollowState()
    // 富文本：等 v-html 渲染完成后再提取目录（MARKDOWN 由 MdCatalog 自动联动）
    if (article.value && article.value.editorType !== 'MARKDOWN') {
      await nextTick()
      buildRichtextToc()
    }
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
})
</script>

<style scoped>
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
</style>
