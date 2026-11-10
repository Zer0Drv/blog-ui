import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const PREFERENCES_KEY = 'blog.reading.preferences'
const POSITIONS_KEY = 'blog.reading.positions'
const TOP_INSET = 80
const MAX_POSITIONS = 40
const defaults = { theme: 'system', size: 'normal', spacing: 'normal' }

function read(key) {
  try { return JSON.parse(window.localStorage.getItem(key)) } catch { return null }
}

function write(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage is optional. */ }
}

export function readingPreferences(value) {
  return {
    theme: ['light', 'dark', 'system'].includes(value?.theme) ? value.theme : defaults.theme,
    size: ['small', 'normal', 'large'].includes(value?.size) ? value.size : defaults.size,
    spacing: ['normal', 'relaxed'].includes(value?.spacing) ? value.spacing : defaults.spacing
  }
}

export function readingIdentity(article) {
  if (article?.visible !== true || article.visibility !== 'PUBLIC' || article.passwordRequired ||
      !/^\d+$/.test(String(article.id))) return null
  const text = String(article.content ?? '')
  // A local content fingerprint invalidates stale offsets without persisting the article.
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return { id: String(article.id), revision: `${article.editorType}:${text.length}:${(hash >>> 0).toString(36)}` }
}

export function readingMinutes(text) {
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
  const characters = (text.match(cjk) || []).length
  const words = (text.replace(cjk, ' ').match(/[\p{L}\p{N}]+/gu) || []).length
  return Math.max(1, Math.ceil(characters / 300 + words / 220))
}

export function useArticleReading(article, body) {
  const preferences = ref(readingPreferences(read(PREFERENCES_KEY)))
  const systemDark = ref(false)
  const theme = computed(() => preferences.value.theme === 'system'
    ? (systemDark.value ? 'dark' : 'light') : preferences.value.theme)
  const progress = ref(0)
  const resume = ref(null)
  let identity
  let media
  let resizeObserver
  let frame
  let timer
  let pending
  let userIntent = false
  let wantsSave = false

  watch(preferences, value => write(PREFERENCES_KEY, readingPreferences(value)), { deep: true })

  function flush() {
    clearTimeout(timer)
    if (!pending) return
    const positions = read(POSITIONS_KEY)
    const entries = positions && typeof positions === 'object' ? Object.entries(positions) : []
    const { id, revision, fraction } = pending
    write(POSITIONS_KEY, Object.fromEntries([
      [id, { revision, fraction, time: Date.now() }],
      ...entries.filter(([key, value]) => key !== id && /^\d+$/.test(key) && typeof value?.time === 'number')
        .sort((a, b) => b[1].time - a[1].time).slice(0, MAX_POSITIONS - 1)
    ]))
    pending = null
  }

  function measure(save = false) {
    if (!body.value) return
    const rect = body.value.getBoundingClientRect()
    const span = rect.height - (window.innerHeight - TOP_INSET)
    const fraction = span > 0
      ? Math.min(1, Math.max(0, (TOP_INSET - rect.top) / span))
      : (rect.bottom <= window.innerHeight && rect.top < window.innerHeight ? 1 : 0)
    progress.value = Math.round(fraction * 100)
    if (!save || !userIntent || !identity || span <= 0 || rect.top >= TOP_INSET || rect.bottom <= TOP_INSET) return
    pending = { ...identity, fraction }
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  }

  function schedule(save = false) {
    wantsSave ||= save
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = null
      const persist = wantsSave
      wantsSave = false
      measure(persist)
    })
  }

  const onScroll = () => schedule(true)
  const onResize = () => schedule()
  const onIntent = () => { userIntent = true }
  const onKey = event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key) &&
        !event.target?.closest?.('input, select, textarea, button, [contenteditable]')) onIntent()
  }
  const onSystemTheme = () => { systemDark.value = Boolean(media?.matches) }

  async function continueReading() {
    if (resume.value == null || !body.value) return
    const element = body.value
    const fraction = resume.value
    resume.value = null
    await nextTick()
    if (body.value !== element) return
    const rect = element.getBoundingClientRect()
    const span = Math.max(0, rect.height - (window.innerHeight - TOP_INSET))
    userIntent = true
    window.scrollTo({ top: window.scrollY + rect.top - TOP_INSET + span * fraction, behavior: 'instant' })
    element.focus({ preventScroll: true })
    schedule(true)
  }

  watch(article, async value => {
    flush()
    identity = readingIdentity(value)
    userIntent = false
    wantsSave = false
    progress.value = 0
    const saved = identity && read(POSITIONS_KEY)?.[identity.id]
    resume.value = saved?.revision === identity?.revision && saved?.fraction > 0.02 &&
      saved.fraction <= 1 ? saved.fraction : null
    await nextTick()
    schedule()
  }, { immediate: true, flush: 'sync' })
  watch(body, element => {
    resizeObserver?.disconnect()
    if (element) resizeObserver?.observe(element)
    onResize()
  }, { flush: 'post' })

  onMounted(() => {
    media = window.matchMedia?.('(prefers-color-scheme: dark)')
    onSystemTheme()
    media?.addEventListener?.('change', onSystemTheme)
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(onResize)
      if (body.value) resizeObserver.observe(body.value)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('wheel', onIntent, { passive: true })
    window.addEventListener('touchmove', onIntent, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pagehide', flush)
  })
  onBeforeUnmount(() => {
    flush()
    if (frame) cancelAnimationFrame(frame)
    media?.removeEventListener?.('change', onSystemTheme)
    resizeObserver?.disconnect()
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('wheel', onIntent)
    window.removeEventListener('touchmove', onIntent)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('pagehide', flush)
  })

  return { preferences, theme, progress, resume, continueReading, updateLayout: onResize }
}
