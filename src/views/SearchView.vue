<template>
  <div class="search-page">
    <h1>搜索文章</h1>
    <p class="intro">按关键词、主题和发布时间查找公开文章；留空关键词可浏览全部文章。</p>
    <form class="search-form" role="search" @submit.prevent="onSearch">
      <label for="search-keyword">关键词
        <input id="search-keyword" v-model="draft.keyword" type="search" maxlength="200" placeholder="搜索文章标题 / 内容" />
      </label>
      <div class="filters">
        <label for="search-category">分类
          <select id="search-category" v-model="draft.categoryId" aria-label="分类">
            <option value="">全部分类</option>
            <option v-if="draft.categoryId && !categories.some(c => String(c.id) === draft.categoryId)" :value="draft.categoryId">分类 #{{ draft.categoryId }}</option>
            <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.label }}</option>
          </select>
        </label>
        <label for="search-tag">标签
          <select id="search-tag" v-model="draft.tagId" aria-label="标签">
            <option value="">全部标签</option>
            <option v-if="draft.tagId && !tags.some(t => String(t.id) === draft.tagId)" :value="draft.tagId">标签 #{{ draft.tagId }}</option>
            <option v-for="t in tags" :key="t.id" :value="String(t.id)">{{ t.name }}</option>
          </select>
        </label>
        <label for="search-from">发布开始日期
          <input id="search-from" v-model="draft.publishedFrom" type="date" min="1000-01-01" :max="draft.publishedTo || '9999-12-30'" />
        </label>
        <label for="search-to">发布结束日期
          <input id="search-to" v-model="draft.publishedTo" type="date" :min="draft.publishedFrom || '1000-01-01'" max="9999-12-30" />
        </label>
        <label for="search-sort">排序
          <select id="search-sort" v-model="draft.sort" aria-label="排序">
            <option value="relevance">相关度</option><option value="newest">最新发布</option><option value="oldest">最早发布</option>
          </select>
        </label>
      </div>
      <p class="date-hint">时间范围包含开始与结束日期。</p>
      <p v-if="validationError" class="error" role="alert">{{ validationError }}</p>
      <div class="actions"><button class="primary" type="submit">搜索</button><button type="button" @click="clearSearch">清空条件</button></div>
    </form>
    <p v-if="optionsError" class="error" role="alert">分类或标签加载失败，可继续搜索。<button type="button" @click="loadOptions">重试筛选选项</button></p>
    <section class="results" aria-label="搜索结果" :aria-busy="loading">
      <p v-if="loading" role="status">正在搜索…</p>
      <div v-else-if="error" class="error" role="alert"><p>{{ error }}</p><button type="button" @click="load">重试搜索</button></div>
      <template v-else-if="!queryError">
        <p class="result-tip" role="status">共找到 {{ total }} 篇{{ applied.keyword ? `与「${applied.keyword}」相关的` : '' }}文章</p>
        <p v-if="sortNotice" class="sort-notice">{{ sortNotice }}</p>
        <div v-if="!articles.length" class="empty-state">
          <p>没有找到相关文章，试试调整关键词或清空条件。</p>
          <button type="button" @click="focusKeyword">调整关键词</button><button type="button" @click="clearSearch">清空条件</button>
        </div>
        <article v-for="a in articles" :key="a.id" class="article-card">
          <img v-if="a.cover" :src="resolveUploadUrl(a.cover)" class="cover" alt="" loading="lazy" />
          <div class="info">
            <h2 class="title"><RouterLink :to="articlePath(a)"><SearchHighlight :text="a.title" :keyword="applied.keyword" /></RouterLink></h2>
            <p class="summary"><SearchHighlight :text="a.snippet ?? a.summary" :keyword="applied.keyword" /></p>
            <div class="meta">
              <span>{{ a.author?.nickname || a.author?.username }}</span>
              <time :datetime="a.publishTime || a.createTime">{{ formatTime(a.publishTime || a.createTime) }}</time>
              <span v-for="t in a.tags || []" :key="t.id" class="tag">{{ t.name }}</span>
            </div>
          </div>
        </article>
        <nav v-if="total > size || applied.page > 1" class="pager" aria-label="搜索分页">
          <button type="button" :disabled="applied.page <= 1" @click="changePage(applied.page - 1)">上一页</button>
          <span>第 {{ applied.page }} 页 / 共 {{ Math.max(1, Math.ceil(total / size)) }} 页</span>
          <button type="button" :disabled="applied.page * size >= total" @click="changePage(applied.page + 1)">下一页</button>
        </nav>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { searchArticles } from '../api/browse'
import { listCategories } from '../api/category'
import { listTags } from '../api/tag'
import { articlePath } from '../utils/articleLink'
import { resolveUploadUrl } from '../api/upload'
import SearchHighlight from '../components/SearchHighlight.vue'

const route = useRoute()
const router = useRouter()
const size = 10
const scalar = value => String(Array.isArray(value) ? value[0] ?? '' : value ?? '')
const positiveId = value => /^[1-9]\d*$/.test(scalar(value)) ? scalar(value) : ''
function readQuery(query) {
  const rawPage = Number(scalar(query.page))
  return {
    keyword: scalar(query.keyword).trim(), categoryId: positiveId(query.categoryId), tagId: positiveId(query.tagId),
    publishedFrom: scalar(query.publishedFrom), publishedTo: scalar(query.publishedTo),
    sort: ['relevance', 'newest', 'oldest'].includes(scalar(query.sort)) ? scalar(query.sort) : 'relevance',
    page: Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1
  }
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1000-01-01' && value <= '9999-12-30' &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
function validate(query) {
  if (query.keyword.length > 200) return '关键词最多 200 个字符，请缩短后搜索。'
  if ([query.publishedFrom, query.publishedTo].some(value => value && !validDate(value))) return '请输入有效的发布日期。'
  if (query.publishedFrom && query.publishedTo && query.publishedFrom > query.publishedTo) return '开始日期不能晚于结束日期。'
  return ''
}
function toQuery(state) {
  const query = {}
  for (const key of ['keyword', 'categoryId', 'tagId', 'publishedFrom', 'publishedTo']) if (state[key]) query[key] = state[key]
  if (state.sort !== 'relevance') query.sort = state.sort
  if (state.page > 1) query.page = String(state.page)
  return query
}

const applied = ref(readQuery(route.query))
const draft = ref({ ...applied.value })
const articles = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const validationError = ref('')
const queryError = ref('')
const searchMode = ref('')
const effectiveSort = ref('')
const categories = ref([])
const tags = ref([])
const optionsError = ref(false)
let active = true
let requestId = 0
let optionsRequestId = 0

const sortNotice = computed(() => {
  const actual = { newest: '最新发布', oldest: '最早发布', relevance: '相关度' }[effectiveSort.value]
  if (!actual) return ''
  if (searchMode.value === 'LIKE' && applied.value.keyword) return `当前使用字面包含匹配，无法计算相关度；结果按${actual}排序。`
  return `按${actual}排序。`
})

async function load() {
  const id = ++requestId
  const state = { ...applied.value }
  articles.value = []; total.value = 0; error.value = ''; searchMode.value = ''; effectiveSort.value = ''
  queryError.value = validate(state)
  validationError.value = queryError.value
  loading.value = !queryError.value
  if (queryError.value) return
  try {
    const data = await searchArticles({ ...toQuery(state), keyword: state.keyword, sort: state.sort, page: state.page, size })
    if (!active || id !== requestId) return
    articles.value = data.records || []
    total.value = Number(data.total) || 0
    searchMode.value = data.searchMode || ''
    effectiveSort.value = data.effectiveSort || ''
  } catch {
    if (!active || id !== requestId) return
    error.value = '搜索失败，请重试。'
  } finally {
    if (active && id === requestId) loading.value = false
  }
}
function navigate(state) {
  validationError.value = validate(state)
  if (validationError.value) return
  if (JSON.stringify(state) === JSON.stringify(applied.value)) load()
  else router.push({ path: route.path, query: toQuery(state) })
}
function onSearch() { navigate({ ...draft.value, keyword: draft.value.keyword.trim(), page: 1 }) }
function clearSearch() { draft.value = readQuery({}); navigate({ ...draft.value }) }
function changePage(page) { navigate({ ...applied.value, page }) }
function focusKeyword() { document.getElementById('search-keyword')?.focus() }
function flattenCategories(nodes, depth = 0) {
  return nodes.flatMap(node => [{ id: node.id, label: `${'　'.repeat(depth)}${node.name}` }, ...flattenCategories(node.children || [], depth + 1)])
}
async function loadOptions() {
  const id = ++optionsRequestId
  optionsError.value = false
  const results = await Promise.allSettled([listCategories(), listTags()])
  if (!active || id !== optionsRequestId) return
  if (results[0].status === 'fulfilled') categories.value = flattenCategories(results[0].value || [])
  if (results[1].status === 'fulfilled') tags.value = results[1].value || []
  optionsError.value = results.some(result => result.status === 'rejected')
}
watch(() => route.query, query => {
  applied.value = readQuery(query)
  draft.value = { ...applied.value }
  load()
}, { immediate: true })
loadOptions()
onBeforeUnmount(() => { active = false; ++requestId; ++optionsRequestId })
function formatTime(value) { return value ? String(value).replace('T', ' ').slice(0, 16) : '' }
</script>

<style scoped>
.search-page { max-width: 860px; margin: 0 auto; }
h1 { font-size: 26px; margin: 0 0 8px; color: #303133; }
.intro, .date-hint, .result-tip, .sort-notice { color: #606266; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.search-form { padding: 20px; border: 1px solid #dcdfe6; border-radius: 8px; background: #fff; }
label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #303133; min-width: 0; }
input, select, button { font: inherit; }
input, select { min-width: 0; width: 100%; box-sizing: border-box; padding: 9px 10px; min-height: 40px; color: #303133; border: 1px solid #c0c4cc; border-radius: 4px; background: #fff; }
input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #337ecc; outline-offset: 3px; }
.filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.date-hint { margin: 12px 0; font-size: 12px; }
.actions { display: flex; gap: 10px; }
button { cursor: pointer; border: 1px solid #c0c4cc; border-radius: 4px; color: #303133; background: #fff; padding: 9px 15px; min-height: 40px; }
button:hover:not(:disabled) { border-color: #337ecc; color: #337ecc; }
button.primary { color: #fff; background: #337ecc; border-color: #337ecc; }
button.primary:hover { background: #2865a4; color: #fff; }
button:disabled { opacity: .5; cursor: not-allowed; }
.results { margin-top: 24px; }
.error { color: #b42318; font-size: 14px; line-height: 1.6; }
.result-tip { margin: 0 0 6px; }
.sort-notice { margin: 0 0 16px; font-size: 12px; }
.empty-state { text-align: center; padding: 32px 12px; color: #606266; }
.empty-state button + button { margin-left: 10px; }
.article-card { display: flex; gap: 16px; padding: 20px; margin-bottom: 14px; border: 1px solid #e4e7ed; border-radius: 8px; background: #fff; }
.cover { width: 160px; height: 110px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.info { min-width: 0; overflow-wrap: anywhere; }
.title { margin: 0 0 8px; font-size: 18px; }
.title a { color: #303133; text-decoration: none; }
.title a:hover { color: #337ecc; text-decoration: underline; }
.summary { margin: 0 0 10px; color: #606266; font-size: 14px; line-height: 1.6; }
.meta { display: flex; align-items: center; gap: 12px; color: #606266; font-size: 12px; flex-wrap: wrap; }
.tag { padding: 2px 6px; border-radius: 3px; background: #ecf5ff; color: #337ecc; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 20px; font-size: 14px; flex-wrap: wrap; }
@media (max-width: 600px) {
  .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .search-form, .article-card { padding: 14px; }
  .cover { width: 80px; height: 70px; }
  .article-card { gap: 12px; }
}
@media (max-width: 360px) { .filters { grid-template-columns: 1fr; } }
</style>
