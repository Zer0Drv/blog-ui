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
      </el-card>
    </template>
    <el-empty v-else description="文章不存在或已删除" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { getArticle } from '../api/article'
import { resolveUploadUrl } from '../api/upload'
import { useAuthStore } from '../stores/auth'

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
