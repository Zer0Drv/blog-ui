<template>
  <section v-if="error || memberships?.length" class="series-navigation" aria-label="系列阅读导航">
    <h2>所属系列</h2>
    <p v-if="error" class="error" role="alert">系列导航暂时无法加载。<button @click="load">重试系列导航</button></p>
    <div v-for="series in memberships || []" v-else :key="series.id" class="membership">
      <RouterLink :to="`/series/${series.slug}`">{{ series.title }}</RouterLink><span class="muted"> · {{ series.articleCount }} 篇</span>
      <div class="reading-links">
        <RouterLink v-if="series.previous" :to="articlePath(series.previous)">上一篇：{{ series.previous.title }}</RouterLink><span v-else class="muted">已是第一篇</span>
        <RouterLink v-if="series.next" :to="articlePath(series.next)">下一篇：{{ series.next.title }}</RouterLink><span v-else class="muted">已是最后一篇</span>
      </div>
    </div>
  </section>
</template>
<script setup>
import { watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getArticleSeries } from '../api/series'
import { articlePath } from '../utils/articleLink'
import { useSeriesResource } from '../composables/useSeriesResource'
import '../assets/series.css'
const props = defineProps({ articleId: { type: [Number, String], required: true } })
const { data: memberships, error, load: fetchMemberships } = useSeriesResource(getArticleSeries, [])
const load = () => fetchMemberships(props.articleId)
watch(() => props.articleId, load, { immediate: true })
</script>
