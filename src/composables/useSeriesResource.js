import { onBeforeUnmount, ref } from 'vue'

// Navigation may reuse a view; late responses must not restore the previous series.
export function useSeriesResource(fetcher, empty = null) {
  const data = ref(empty)
  const loading = ref(false)
  const error = ref('')
  let sequence = 0
  let active = true
  function reset() { sequence++; data.value = empty; loading.value = false; error.value = '' }
  async function load(...args) {
    if (!active) return
    const current = ++sequence
    data.value = empty
    error.value = ''
    loading.value = true
    try {
      const result = await fetcher(...args)
      if (active && current === sequence) data.value = result
      return active && current === sequence ? result : undefined
    } catch (e) {
      if (active && current === sequence) error.value = e.message || '加载失败，请重试。'
    } finally {
      if (active && current === sequence) loading.value = false
    }
  }
  onBeforeUnmount(() => { active = false; sequence++ })
  return { data, loading, error, load, reset }
}
