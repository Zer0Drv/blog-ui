<template>
  <div class="object-preview">
    <template v-if="safeSrc">
      <el-image :src="safeSrc" :preview-src-list="[safeSrc]" :preview-teleported="true"
        fit="cover" :alt="label" tabindex="0" @keydown.enter="$event.currentTarget.click()">
        <template #placeholder><span role="status">加载中…</span></template>
        <template #error><span role="status">图片不可用</span></template>
      </el-image>
      <a :href="safeOriginal" target="_blank" rel="noopener noreferrer">{{ download ? '下载原文件' : '查看原图' }}</a>
    </template>
    <span v-else>暂无预览</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ src: String, original: String, label: { type: String, default: '图片预览' }, download: Boolean })
function safe(value) {
  if (!value) return ''
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
const safeSrc = computed(() => safe(props.src))
const safeOriginal = computed(() => safe(props.original || props.src))
</script>

<style scoped>
.object-preview { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.el-image { width: 56px; height: 56px; cursor: zoom-in; }
</style>
