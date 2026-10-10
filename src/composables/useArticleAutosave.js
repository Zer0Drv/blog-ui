import { computed, onBeforeUnmount, ref } from 'vue'
import { autosaveArticle } from '../api/article'
import { AUTOSAVE_DELAY, DRAFT_NEW_KEY, formatClock } from '../utils/articleEdit'

// 默认本地轨：新文章（无 id）自动保存落 localStorage。
// 注意现状（行为锁测试锁定）：localStorage 仅在 30s 定时器到点时写入，
// 卸载补存不走本地轨——新文章在 30s 内离开页面草稿即丢。
function defaultSaveLocal(body) {
  localStorage.setItem(DRAFT_NEW_KEY, JSON.stringify({ ...body, savedAt: Date.now() }))
}

/**
 * 自动保存显式状态机（原 ArticleEditView 内联 dirty/定时器/双轨逻辑下沉）。
 *
 * 状态迁移：clean →(notifyChanged)→ pending →(delay 到点)→ saving →(成功)→ clean
 *                  ↑_______________(失败 / 正文为空)→ dirtyIdle（驻留不重试，等下次编辑）
 *
 * 内部以 dirty / saving / timerArmed 三个原语精确复刻旧隐式状态机的所有交错行为，
 * status 为派生只读视图。注入式端口：测试传替身，零 mock 框架。
 *
 * @param {{
 *   articleId: import('vue').Ref<string|null>,
 *   buildBody: () => object|null,
 *   saveRemote?: (id: string, body: object) => Promise<any>,
 *   saveLocal?: (body: object) => void,
 *   delay?: number
 * }} options
 * @returns {{
 *   status: import('vue').ComputedRef<'clean'|'pending'|'saving'|'dirtyIdle'>,
 *   tip: import('vue').ComputedRef<string>,
 *   notifyChanged(): void,
 *   markInitialized(): void,
 *   clearDraft(): void
 * }}
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
  const initialized = ref(false)
  let timer = null

  const status = computed(() => {
    if (saving.value) return 'saving'
    if (!dirty.value) return 'clean'
    return timerArmed.value ? 'pending' : 'dirtyIdle'
  })

  const tip = computed(() => {
    if (dirty.value) return '有未保存的修改'
    return lastSavedAt.value ? `已自动保存 ${lastSavedAt.value}` : ''
  })

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    timerArmed.value = false
  }

  function armTimer() {
    clearTimer()
    timerArmed.value = true
    timer = setTimeout(run, delay)
  }

  // 编辑变更入口。initialized 门：初始填充不触发计时；
  // 版本恢复发生在 markInitialized 之后，其表单回填会重新武装一次计时——
  // 属 RFC 确认的现存行为，行为锁测试锁定。
  function notifyChanged() {
    if (!initialized.value) return
    dirty.value = true
    armTimer()
  }

  function markInitialized() {
    initialized.value = true
  }

  async function run() {
    timer = null
    timerArmed.value = false
    if (!dirty.value) return
    const body = buildBody()
    // 正文为空不落轨，dirty 驻留 → dirtyIdle
    if (!body) return
    if (articleId.value) {
      saving.value = true
      try {
        const data = await saveRemote(articleId.value, body)
        lastSavedAt.value = formatClock(data?.savedAt || Date.now())
        dirty.value = false
      } catch { /* 拦截器已提示；驻留 dirtyIdle 不重试 */ } finally {
        saving.value = false
      }
    } else {
      // 新文章无服务端 autosave，落 localStorage
      saveLocal(body)
      lastSavedAt.value = formatClock(Date.now())
      dirty.value = false
    }
  }

  // 正式保存成功后清场（服务端会自删 autosave；本地清 localStorage 草稿与未保存标记）
  function clearDraft() {
    dirty.value = false
    clearTimer()
    localStorage.removeItem(DRAFT_NEW_KEY)
  }

  onBeforeUnmount(() => {
    // 卸载前对已存在文章补一次自动保存（只走服务端轨）；
    // 与编辑器 destroy 分钩：编辑器生命周期归页面/组件，这里只管自动保存。
    clearTimer()
    if (dirty.value && articleId.value) {
      const body = buildBody()
      if (body) saveRemote(articleId.value, body).catch(() => {})
    }
  })

  return { status, tip, notifyChanged, markInitialized, clearDraft }
}
