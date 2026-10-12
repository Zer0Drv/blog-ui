<template>
  <div class="my-favorites">
    <h2 class="page-title">我的收藏</h2>
    <el-skeleton v-if="loading" :rows="6" animated />
    <template v-else>
      <el-empty v-if="!articles.length" description="暂无收藏的文章" />
      <el-card
        v-for="a in articles"
        :key="a.id"
        class="article-card"
        :class="{ 'is-offline': a.visible === false }"
        shadow="hover"
        @click="onCardClick(a)"
      >
        <el-tag v-if="a.visible === false" type="info" size="small" class="offline-badge">已下架</el-tag>
        <div class="card-body">
          <img v-if="a.cover" :src="resolveUploadUrl(a.cover)" class="cover" alt="cover" />
          <div class="info">
            <h3 class="title">{{ a.title }}</h3>
            <p class="summary">{{ a.summary }}</p>
            <div class="meta">
              <span>{{ a.author?.nickname || a.author?.username }}</span>
              <span>{{ formatTime(a.publishTime || a.createTime) }}</span>
              <el-tag
                v-for="t in a.tags || []"
                :key="t.id"
                size="small"
                class="tag"
              >{{ t.name }}</el-tag>
            </div>
          </div>
        </div>
      </el-card>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="onSizeChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { pageMyFavorites } from '../api/interaction'
import { resolveUploadUrl } from '../api/upload'

const router = useRouter()

const articles = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await pageMyFavorites(page.value, size.value)
    articles.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onSizeChange() {
  page.value = 1
  load()
}

// 已下架/定时中（visible === false）的文章保留展示但不可进入详情
function onCardClick(a) {
  if (a.visible === false) {
    ElMessage.warning('文章已下架')
    return
  }
  goDetail(a.id)
}

function goDetail(id) {
  router.push(`/article/${id}`)
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

onMounted(load)
</script>

<style scoped>
.page-title {
  margin: 0 0 16px;
  color: #303133;
}
.article-card {
  position: relative;
  margin-bottom: 14px;
  cursor: pointer;
}
/* 已下架：内容灰化 + 不可点（角标保持实色可读） */
.article-card.is-offline {
  cursor: default;
}
.article-card.is-offline .card-body {
  opacity: 0.55;
}
.article-card.is-offline .cover {
  filter: grayscale(1);
}
.offline-badge {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 1;
}
.card-body {
  display: flex;
  gap: 16px;
}
.cover {
  width: 160px;
  height: 110px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.info {
  min-width: 0;
}
.title {
  margin: 0 0 8px;
  font-size: 18px;
  color: #303133;
}
.summary {
  margin: 0 0 10px;
  color: #909399;
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #909399;
  font-size: 12px;
  flex-wrap: wrap;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
