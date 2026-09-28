<template>
  <div class="home">
    <div class="main-col">
      <el-input
        v-model="keyword"
        class="search"
        placeholder="搜索标题 / 摘要"
        clearable
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #append>
          <el-button @click="onSearch">搜索</el-button>
        </template>
      </el-input>

      <el-skeleton v-if="loading" :rows="6" animated />
      <template v-else>
        <el-empty v-if="!articles.length" description="暂无文章" />
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
              <h3 class="title">
                <el-tag v-if="Number(a.isTop) === 1" type="danger" size="small" class="top-tag">置顶</el-tag>
                {{ a.title }}
              </h3>
              <p class="summary">{{ a.summary }}</p>
              <div class="meta">
                <span>{{ a.author?.nickname || a.author?.username }}</span>
                <span>{{ formatTime(a.publishTime || a.createTime) }}</span>
                <el-tag
                  v-for="t in a.tags || []"
                  :key="t.id"
                  size="small"
                  class="tag"
                  @click.stop="onTagFilter(t.id)"
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

    <aside class="side-col">
      <el-card class="side-card">
        <template #header>
          <div class="side-header">
            <span>分类</span>
            <el-button v-if="categoryId" link type="primary" size="small" @click="onCategoryFilter(null)">
              清除
            </el-button>
          </div>
        </template>
        <el-tree
          :data="categories"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          highlight-current
          :expand-on-click-node="true"
          @node-click="node => onCategoryFilter(node.id)"
        />
      </el-card>
      <el-card class="side-card">
        <template #header>
          <div class="side-header">
            <span>标签</span>
            <el-button v-if="tagId" link type="primary" size="small" @click="onTagFilter(null)">
              清除
            </el-button>
          </div>
        </template>
        <div class="tag-cloud">
          <el-check-tag
            v-for="t in tags"
            :key="t.id"
            :checked="tagId === t.id"
            class="cloud-tag"
            @change="onTagFilter(tagId === t.id ? null : t.id)"
          >{{ t.name }}</el-check-tag>
          <span v-if="!tags.length" class="empty-tip">暂无标签</span>
        </div>
      </el-card>
    </aside>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { pageArticles } from '../api/article'
import { listCategories } from '../api/category'
import { listTags } from '../api/tag'
import { resolveUploadUrl } from '../api/upload'

const router = useRouter()

const articles = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const keyword = ref('')
const tagId = ref(null)
const categoryId = ref(null)
const loading = ref(false)
const categories = ref([])
const tags = ref([])

async function load() {
  loading.value = true
  try {
    const data = await pageArticles({
      page: page.value,
      size: size.value,
      keyword: keyword.value || undefined,
      tagId: tagId.value || undefined,
      categoryId: categoryId.value || undefined
    })
    articles.value = data.records || []
    total.value = Number(data.total) || 0
  } catch { /* 拦截器已提示 */ } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}

function onSizeChange() {
  page.value = 1
  load()
}

function onTagFilter(id) {
  tagId.value = id
  page.value = 1
  load()
}

function onCategoryFilter(id) {
  categoryId.value = id
  page.value = 1
  load()
}

function goDetail(id) {
  router.push(`/article/${id}`)
}

function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

onMounted(() => {
  load()
  listCategories().then(d => { categories.value = d || [] }).catch(() => {})
  listTags().then(d => { tags.value = d || [] }).catch(() => {})
})
</script>

<style scoped>
.home {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.main-col {
  flex: 1;
  min-width: 0;
}
.search {
  margin-bottom: 16px;
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
.top-tag {
  margin-right: 6px;
  vertical-align: 2px;
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
.tag {
  cursor: pointer;
}
.author {
  cursor: pointer;
}
.author:hover {
  color: #409eff;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.side-col {
  width: 260px;
  flex-shrink: 0;
}
.side-card {
  margin-bottom: 16px;
}
.side-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cloud-tag {
  cursor: pointer;
}
.empty-tip {
  color: #909399;
  font-size: 13px;
}
@media (max-width: 800px) {
  .home {
    flex-direction: column;
  }
  .side-col {
    width: 100%;
  }
}
</style>
