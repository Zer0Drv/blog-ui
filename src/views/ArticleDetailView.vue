<template>
  <div class="detail">
    <el-skeleton v-if="loading" :rows="10" animated />
    <template v-else-if="article">
      <el-card>
        <h1 class="title">{{ article.title }}</h1>
        <div class="meta">
          <span class="author">{{ article.author?.nickname || article.author?.username }}</span>
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
        <MdPreview
          v-if="article.editorType === 'MARKDOWN'"
          :model-value="article.content || ''"
          :editor-id="previewId"
        />
        <!-- 后端文章内容由作者本人产生；RICHTEXT 模式按契约直接渲染 HTML -->
        <div v-else class="richtext" v-html="article.content" />

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
    </template>
    <el-empty v-else description="文章不存在或已删除" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { ElMessage } from 'element-plus'
import { View, Pointer, Star, ChatDotRound } from '@element-plus/icons-vue'
import { getArticle } from '../api/article'
import { likeArticle, unlikeArticle, favoriteArticle, unfavoriteArticle } from '../api/interaction'
import { resolveUploadUrl } from '../api/upload'
import { useAuthStore } from '../stores/auth'
import CommentSection from '../components/CommentSection.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const article = ref(null)
const loading = ref(true)
const previewId = `preview-${route.params.id}`

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

onMounted(async () => {
  if (auth.isLoggedIn && !auth.user) {
    try { await auth.fetchMe() } catch { /* 忽略 */ }
  }
  try {
    article.value = await getArticle(route.params.id)
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
