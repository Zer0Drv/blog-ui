<template>
  <template v-for="(part, index) in parts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ text: { type: String, default: '' }, keyword: { type: String, default: '' } })
// User input becomes literal match terms; Vue renders text nodes, never article HTML.
const parts = computed(() => {
  const text = props.text || ''
  const terms = [...new Set(props.keyword.trim().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!terms.length) return [{ text, match: false }]
  const matcher = new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu')
  const result = []
  let offset = 0
  for (const match of text.matchAll(matcher)) {
    if (match.index > offset) result.push({ text: text.slice(offset, match.index), match: false })
    result.push({ text: match[0], match: true })
    offset = match.index + match[0].length
  }
  if (offset < text.length) result.push({ text: text.slice(offset), match: false })
  return result
})
</script>

<style scoped>
mark { background: #fff1b8; color: inherit; border-radius: 2px; }
</style>
