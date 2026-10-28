<template>
  <div class="series-page">
    <h1>{{ management ? '我的系列' : '系列文章' }}</h1>
    <p class="muted">{{ management ? '整理属于同一作者的文章，安排阅读顺序。隐藏系列不会修改文章本身。' : '按章节顺序阅读教程、项目记录和专题文章。' }}</p>
    <div v-if="management" class="actions">
      <RouterLink to="/my/series/new">新建系列</RouterLink>
      <label v-if="isAdmin" class="inline-label"><input type="checkbox" :checked="all" @change="changeScope($event.target.checked)" />管理全部系列</label>
    </div>
    <p v-if="loading" role="status">正在加载系列…</p>
    <div v-else-if="error" role="alert" class="error">{{ error }} <button @click="load">重试加载</button></div>
    <template v-else>
      <p v-if="!data?.records?.length" class="muted">{{ management ? '还没有系列，创建一个开始整理文章。' : '暂无公开系列。' }}</p>
      <article v-for="series in data?.records || []" :key="series.id" class="series-card">
        <h2><RouterLink :to="management ? `/my/series/${series.id}` : `/series/${series.slug}`">{{ series.title }}</RouterLink></h2>
        <img v-if="series.cover" :src="resolveUploadUrl(series.cover)" alt="" class="series-cover" loading="lazy" />
        <p class="description">{{ series.description }}</p>
        <p class="muted">{{ series.ownerName }} · {{ series.articleCount }} 篇{{ management ? '' : '公开文章' }}<span v-if="management"> · {{ series.status === 'PUBLISHED' ? '公开' : '草稿' }}</span></p>
        <div v-if="management" class="actions"><RouterLink :to="`/my/series/${series.id}`">编辑系列</RouterLink><RouterLink v-if="series.status === 'PUBLISHED'" :to="`/series/${series.slug}`">公开预览</RouterLink></div>
      </article>
      <nav v-if="data?.total > size || page > 1" class="pager" aria-label="系列分页">
        <button :disabled="page <= 1" @click="changePage(page - 1)">上一页</button><span>第 {{ page }} 页</span>
        <button :disabled="page * size >= Number(data?.total || 0)" @click="changePage(page + 1)">下一页</button>
      </nav>
    </template>
  </div>
</template>
<script setup>
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { pageSeries, pageManagedSeries } from '../api/series'
import { resolveUploadUrl } from '../api/upload'
import { useCurrentUser } from '../composables/useCurrentUser'
import { useSeriesResource } from '../composables/useSeriesResource'
import '../assets/series.css'
const props = defineProps({ management: Boolean })
const route = useRoute(), router = useRouter()
const { isAdmin } = useCurrentUser()
const size = 12
const page = computed(() => /^\d+$/.test(String(route.query.page)) ? Math.max(1, Math.min(100000, Number(route.query.page))) : 1)
const all = computed(() => props.management && isAdmin.value && route.query.all === 'true')
const { data, loading, error, load: fetchPage } = useSeriesResource(params => props.management ? pageManagedSeries(params) : pageSeries(params))
const load = () => fetchPage({ page: page.value, size, ...(props.management ? { all: all.value } : {}) })
function changePage(value) { router.push({ query: { ...(all.value ? { all: 'true' } : {}), ...(value > 1 ? { page: String(value) } : {}) } }) }
function changeScope(value) { router.push({ query: value ? { all: 'true' } : {} }) }
watch(() => [page.value, all.value], load, { immediate: true })
</script>
