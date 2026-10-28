<template>
  <template v-for="(part, index) in parts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  text: { type: String, default: '' },
  keyword: { type: String, default: '' },
  terms: { type: Array, default: undefined }
})
// Server terms describe actual FULLTEXT/LIKE hits. An empty array is authoritative;
// older responses fall back to literal keyword tokens without guessing ngrams.
// All terms are escaped and Vue renders text nodes, never article HTML.
const parts = computed(() => {
  const text = props.text || ''
  const candidates = Array.isArray(props.terms) ? props.terms : props.keyword.trim().split(/\s+/)
  const terms = [...new Set(candidates.filter(term => typeof term === 'string' && term.length > 0))].sort((a, b) => b.length - a.length)
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
