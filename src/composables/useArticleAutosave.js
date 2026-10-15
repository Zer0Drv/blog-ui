import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { autosaveArticle } from '../api/article'
import { AUTOSAVE_DELAY, DRAFT_NEW_KEY, formatClock } from '../utils/articleEdit'

function defaultSaveLocal(body) {
  localStorage.setItem(DRAFT_NEW_KEY, JSON.stringify({ ...body, savedAt: Date.now() }))
}

/**
 * 30s 防抖，单个在途请求；到点时仍在保存则合并为下一次最新快照。
 * 快照归属文章 ID、清场代次与编辑 revision，旧响应只能完成自己的版本。
 * flush() 供路由离开/正式保存等待草稿落轨，失败返回 false 并保留脏状态。
 */
export function useArticleAutosave({
  articleId,
  buildBody,
  saveRemote = autosaveArticle,
  saveLocal = defaultSaveLocal,
  delay = AUTOSAVE_DELAY
}) {
  const dirty = ref(false)
  const saving = ref(false)
  const timerArmed = ref(false)
  const lastSavedAt = ref('')
  let initialized = false
  let disposed = false
  let revision = 0
  let generation = 0
  let timer = null
  let inFlight = null
  let due = false

  const status = computed(() => {
    if (saving.value) return 'saving'
    if (!dirty.value) return 'clean'
    return timerArmed.value ? 'pending' : 'dirtyIdle'
  })
  const tip = computed(() => dirty.value
    ? '有未保存的修改'
    : lastSavedAt.value ? `已自动保存 ${lastSavedAt.value}` : '')

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    timerArmed.value = false
  }

  function notifyChanged() {
    if (!initialized || disposed) return
    revision++
    dirty.value = true
    due = false
    clearTimer()
    timerArmed.value = true
    timer = setTimeout(run, delay)
  }

  function markInitialized() {
    if (!disposed) initialized = true
  }

  function markClean() {
    generation++
    dirty.value = false
    lastSavedAt.value = ''
    due = false
    clearTimer()
  }

  watch(articleId, () => {
    markClean()
    initialized = false
  }, { flush: 'sync' })

  function isCurrent(snapshot) {
    return !disposed && snapshot.id === articleId.value && snapshot.generation === generation
  }

  async function persist(snapshot) {
    try {
      const data = snapshot.id
        ? await saveRemote(snapshot.id, snapshot.body)
        : saveLocal(snapshot.body)
      if (isCurrent(snapshot) && snapshot.revision === revision) {
        dirty.value = false
        lastSavedAt.value = formatClock(data?.savedAt || Date.now())
      }
      return true
    } catch {
      // 无新编辑时驻留 dirtyIdle；不自动重试失败的同一版本。
      return false
    }
  }

  function run() {
    clearTimer()
    if (disposed || !dirty.value) return Promise.resolve(true)
    if (inFlight) {
      due = true
      return inFlight.promise
    }
    const body = buildBody()
    if (!body) return Promise.resolve(false)
    const snapshot = { id: articleId.value, body, revision, generation }
    saving.value = true
    const request = { snapshot, promise: null }
    inFlight = request
    request.promise = persist(snapshot).finally(() => {
      inFlight = null
      saving.value = false
      if (!disposed && due && dirty.value && !timerArmed.value) {
        due = false
        run()
      }
    })
    return request.promise
  }

  async function flush() {
    clearTimer()
    while (!disposed && (dirty.value || inFlight)) {
      const snapshot = inFlight?.snapshot || { generation, revision }
      const ok = await (inFlight ? inFlight.promise : run())
      // 较旧版本失败时仍尝试最新修改；只有当前版本失败才报告未能保存。
      if (!ok && snapshot.generation === generation && snapshot.revision === revision) return false
      clearTimer()
    }
    return true
  }

  function clearDraft() {
    markClean()
    localStorage.removeItem(DRAFT_NEW_KEY)
  }

  onBeforeUnmount(() => {
    clearTimer()
    // 必须在卸载时捕获 ID/正文。若已有旧请求，补存排在它之后，避免回退。
    const body = dirty.value ? buildBody() : null
    const snapshot = { id: articleId.value, body, revision, generation }
    const pending = inFlight
    disposed = true
    if (!body) return
    if (pending && pending.snapshot.generation === generation && pending.snapshot.revision === revision) return
    if (pending) pending.promise.then(() => persist(snapshot))
    else persist(snapshot)
  })

  return { status, tip, notifyChanged, markInitialized, markClean, clearDraft, flush }
}
