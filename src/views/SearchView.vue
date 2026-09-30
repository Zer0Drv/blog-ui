<template>
  <div class="search-page">
    <el-input
      v-model="keyword"
      size="large"
      class="search-input"
      placeholder="搜索文章标题 / 内容，回车搜索"
      clearable
      @keyup.enter="onSearch"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
      <template #append>
        <el-button @click="onSearch">搜索</el-button>
      </template>
    </el-input>

    <!-- 空 keyword：提示 -->
    <el-empty v-if="!searchedKeyword" description="输入关键词后回车开始搜索" />

    <template v-else>
      <el-skeleton v-if="loading" :rows="6" animated />
      <template v-else>
        <p class="result-tip">共找到 {{ total }} 篇与「{{ searchedKeyword }}」相关的文章</p>
        <el-empty v-if="!articles.length" description="没有找到相关文章，换个关键词试试" />
        <!-- 结果卡片样式复用首页文章卡片 -->
        <el-card
          v-for="a in articles"
          :key="a.id"
          class="article-card"
          shadow="hover"
          @click="goDetail(a.id)"
        >
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
        <div v-if="total > size" class="pager">
          <el-pagination
            v-model:current-page="page"
            :page-size="size"
            :total="total"
            layout="total, prev, pager, next"
            background
            @current-change="load"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { searchArticles } from '../api/browse'
import { resolveUploadUrl } from '../api/upload'

const route = useRoute()
const router = useRouter()

const keyword = ref('')
const searchedKeyword = ref('')
const articles = ref([])
const total = ref(0)
const page = ref(1)
const size = 10
const loading = ref(false)

async function load() {
  if (!searchedKeyword.value) return
  loading.value = true
  try {
    const data = await searchArticles({
      keyword: searchedKeyword.value,
      page: page.value,
      size
    })
    articles.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

// 回车/按钮：同步 query，由 watch 统一驱动搜索
function onSearch() {
  const kw = keyword.value.trim()
  router.replace({ query: kw ? { keyword: kw } : {} })
}

// query 变化（immediate 覆盖首次进入，watch 覆盖回车同步）即重新搜索
watch(
  () => route.query.keyword,
  kw => {
    const k = String(kw || '').trim()
    keyword.value = k
    searchedKeyword.value = k
    page.value = 1
    articles.value = []
    total.value = 0
    if (k) load()
  },
  { immediate: true }
)

function goDetail(id) {
  router.push(`/article/${id}`)
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}
</script>

<style scoped>
.search-page {
  max-width: 860px;
  margin: 0 auto;
}
.search-input {
  margin-bottom: 20px;
}
.result-tip {
  margin: 0 0 14px;
  color: #909399;
  font-size: 13px;
}
.article-card {
  margin-bottom: 14px;
  cursor: pointer;
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
@media (max-width: 600px) {
  .cover {
    width: 110px;
    height: 80px;
  }
}
</style>
