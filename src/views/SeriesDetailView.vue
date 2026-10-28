<template>
  <div class="series-page">
    <RouterLink to="/series">全部系列</RouterLink>
    <p v-if="loading" role="status">正在加载系列…</p>
    <div v-else-if="error" role="alert" class="error">系列不存在、未公开或暂时无法加载。<button @click="load">重试加载</button></div>
    <article v-else-if="series" class="panel">
      <h1>{{ series.title }}</h1>
      <p class="muted">{{ series.ownerName }} · {{ series.articleCount }} 篇公开文章</p>
      <img v-if="series.cover" :src="resolveUploadUrl(series.cover)" alt="" class="series-cover" />
      <p class="description">{{ series.description }}</p>
      <h2>章节目录</h2>
      <ol v-if="series.articles?.length" class="chapter-list"><li v-for="chapter in series.articles" :key="chapter.id"><RouterLink :to="articlePath(chapter)">{{ chapter.title }}</RouterLink></li></ol>
      <p v-else class="muted">暂无可公开阅读的章节。</p>
    </article>
  </div>
</template>
<script setup>
import { watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getSeries } from '../api/series'
import { resolveUploadUrl } from '../api/upload'
import { articlePath } from '../utils/articleLink'
import { useDocumentTitle } from '../composables/useDocumentTitle'
import { useSeriesResource } from '../composables/useSeriesResource'
import '../assets/series.css'
const route = useRoute()
const { setTitle } = useDocumentTitle()
const { data: series, loading, error, load: fetchSeries } = useSeriesResource(getSeries)
async function load() { setTitle('系列'); const value = await fetchSeries(route.params.slug); if (value) setTitle(value.title) }
watch(() => route.params.slug, load, { immediate: true })
</script>
