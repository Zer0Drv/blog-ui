import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useArticleAutosave } from '../useArticleAutosave'
import { DRAFT_NEW_KEY, formatClock, parseLocalDraft } from '../../utils/articleEdit'

// 挂最小测试组件：composable 依赖 onBeforeUnmount 生命周期
function mountAutosave(options) {
  let api
  const wrapper = mount(defineComponent({
    template: '<div />',
    setup() {
      api = useArticleAutosave(options)
      return {}
    }
  }))
  return { wrapper, api }
}

const BODY = { title: '标题', content: '正文', summary: '', cover: '', categoryId: null }

function setup(overrides = {}) {
  const saveRemote = vi.fn().mockResolvedValue({ savedAt: 1720000000000 })
  const saveLocal = vi.fn()
  const mounted = mountAutosave({
    articleId: ref('42'),
    buildBody: () => BODY,
    saveRemote,
    saveLocal,
    delay: 30000,
    ...overrides
  })
  return { ...mounted, saveRemote, saveLocal }
}

describe('useArticleAutosave 状态机', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('未 markInitialized：变更不计时不保存', async () => {
    const { api, saveRemote, saveLocal } = setup()
    api.notifyChanged()
    expect(api.status.value).toBe('clean')

    await vi.advanceTimersByTimeAsync(60000)
    expect(saveRemote).not.toHaveBeenCalled()
    expect(saveLocal).not.toHaveBeenCalled()
  })

  it('有 id：30s 到点走 saveRemote，不碰 localStorage', async () => {
    const { api, saveRemote, saveLocal } = setup()
    api.markInitialized()
    api.notifyChanged()
    expect(api.status.value).toBe('pending')
    expect(api.tip.value).toBe('有未保存的修改')

    await vi.advanceTimersByTimeAsync(30000)
    expect(saveRemote).toHaveBeenCalledTimes(1)
    expect(saveRemote).toHaveBeenCalledWith('42', BODY)
    expect(saveLocal).not.toHaveBeenCalled()
    expect(localStorage.getItem(DRAFT_NEW_KEY)).toBeNull()
    expect(api.status.value).toBe('clean')
    expect(api.tip.value).toBe(`已自动保存 ${formatClock(1720000000000)}`)
  })

  it('无 id：走 saveLocal 本地轨，不调 saveRemote', async () => {
    const { api, saveRemote, saveLocal } = setup({ articleId: ref(null) })
    api.markInitialized()
    api.notifyChanged()

    await vi.advanceTimersByTimeAsync(30000)
    expect(saveLocal).toHaveBeenCalledTimes(1)
    expect(saveLocal).toHaveBeenCalledWith(BODY)
    expect(saveRemote).not.toHaveBeenCalled()
    expect(api.status.value).toBe('clean')
  })

  it('默认 saveLocal：写 localStorage draft:new 并带 savedAt', async () => {
    const saveRemote = vi.fn()
    const { api } = mountAutosave({
      articleId: ref(null),
      buildBody: () => BODY,
      saveRemote,
      delay: 30000
    })
    api.markInitialized()
    api.notifyChanged()

    await vi.advanceTimersByTimeAsync(30000)
    const raw = localStorage.getItem(DRAFT_NEW_KEY)
    expect(raw).toBeTruthy()
    const draft = JSON.parse(raw)
    expect(draft.title).toBe('标题')
    expect(typeof draft.savedAt).toBe('number')
    expect(saveRemote).not.toHaveBeenCalled()
  })

  it('连续编辑重置计时：防抖窗口内只存一次', async () => {
    const { api, saveRemote } = setup()
    api.markInitialized()

    api.notifyChanged()
    await vi.advanceTimersByTimeAsync(20000)
    api.notifyChanged() // 重置计时
    await vi.advanceTimersByTimeAsync(20000) // 距首次 40s，但距上次仅 20s
    expect(saveRemote).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(10000)
    expect(saveRemote).toHaveBeenCalledTimes(1)
    expect(api.status.value).toBe('clean')
  })

  it('保存进行中状态为 saving', async () => {
    let resolveSave
    const saveRemote = vi.fn().mockImplementation(() => new Promise(r => { resolveSave = r }))
    const { api } = setup({ saveRemote })
    api.markInitialized()
    api.notifyChanged()

    await vi.advanceTimersByTimeAsync(30000)
    expect(api.status.value).toBe('saving')

    resolveSave({ savedAt: 1720000000000 })
    await Promise.resolve()
    expect(api.status.value).toBe('clean')
  })

  it('saveRemote 失败：驻留 dirtyIdle 不重试，下次编辑才重新计时', async () => {
    const saveRemote = vi.fn().mockRejectedValue(new Error('网络错误'))
    const { api } = setup({ saveRemote })
    api.markInitialized()
    api.notifyChanged()

    await vi.advanceTimersByTimeAsync(30000)
    expect(saveRemote).toHaveBeenCalledTimes(1)
    expect(api.status.value).toBe('dirtyIdle')
    expect(api.tip.value).toBe('有未保存的修改')

    // 驻留：不再自动重试
    await vi.advanceTimersByTimeAsync(120000)
    expect(saveRemote).toHaveBeenCalledTimes(1)

    // 下次编辑重新武装计时
    api.notifyChanged()
    expect(api.status.value).toBe('pending')
    await vi.advanceTimersByTimeAsync(30000)
    expect(saveRemote).toHaveBeenCalledTimes(2)
  })

  it('buildBody 返回 null（正文为空）：不保存，保持脏（dirtyIdle）', async () => {
    const { api, saveRemote, saveLocal } = setup({ buildBody: () => null })
    api.markInitialized()
    api.notifyChanged()

    await vi.advanceTimersByTimeAsync(30000)
    expect(saveRemote).not.toHaveBeenCalled()
    expect(saveLocal).not.toHaveBeenCalled()
    expect(api.status.value).toBe('dirtyIdle')
    expect(api.tip.value).toBe('有未保存的修改')
  })

  it('clearDraft 清场：清 dirty、清计时器、删 localStorage 草稿', async () => {
    localStorage.setItem(DRAFT_NEW_KEY, '{"title":"旧草稿"}')
    const { api, saveRemote, saveLocal } = setup()
    api.markInitialized()
    api.notifyChanged()
    expect(api.status.value).toBe('pending')

    api.clearDraft()
    expect(api.status.value).toBe('clean')
    expect(localStorage.getItem(DRAFT_NEW_KEY)).toBeNull()

    await vi.advanceTimersByTimeAsync(60000)
    expect(saveRemote).not.toHaveBeenCalled()
    expect(saveLocal).not.toHaveBeenCalled()
  })

  it('卸载补存：有 id 且脏时立即补一次 saveRemote（仍走服务端轨，不写本地），并清掉计时器', async () => {
    const { api, wrapper, saveRemote, saveLocal } = setup()
    api.markInitialized()
    api.notifyChanged()

    await wrapper.unmount()
    expect(saveRemote).toHaveBeenCalledTimes(1)
    expect(saveRemote).toHaveBeenCalledWith('42', BODY)
    // 修正 B 回归：有 id 时卸载补存不碰本地轨
    expect(saveLocal).not.toHaveBeenCalled()
    expect(localStorage.getItem(DRAFT_NEW_KEY)).toBeNull()

    // 计时器已清：时间推进不会再存第二次
    await vi.advanceTimersByTimeAsync(60000)
    expect(saveRemote).toHaveBeenCalledTimes(1)
  })

  it('卸载补存：正文为空（buildBody null）时不补存（有 id / 无 id 都不写）', async () => {
    const { api, wrapper, saveRemote } = setup({ buildBody: () => null })
    api.markInitialized()
    api.notifyChanged()

    await wrapper.unmount()
    expect(saveRemote).not.toHaveBeenCalled()
    expect(localStorage.getItem(DRAFT_NEW_KEY)).toBeNull()

    // 修正 B 回归：新文章空内容卸载同样不写 localStorage
    const second = setup({ articleId: ref(null), buildBody: () => null })
    second.api.markInitialized()
    second.api.notifyChanged()
    await second.wrapper.unmount()
    expect(second.saveRemote).not.toHaveBeenCalled()
    expect(second.saveLocal).not.toHaveBeenCalled()
    expect(localStorage.getItem(DRAFT_NEW_KEY)).toBeNull()
  })

  it('行为锁①（修正 A 反转）：版本恢复 markClean 后 30s 不自动保存、保持 clean；再次手动编辑重新计时', async () => {
    const { api, saveRemote } = setup()
    // 初始填充阶段：initialized 门挡住，不计时
    api.notifyChanged()
    await vi.advanceTimersByTimeAsync(60000)
    expect(saveRemote).not.toHaveBeenCalled()

    // 版本恢复 reloadArticle→fillArticle 的回填触发 watch → notifyChanged（initialized 后），
    // 视图随后调 markClean() 复位：清脏 + 停表，恢复本身不再武装自动保存
    api.markInitialized()
    api.notifyChanged()
    expect(api.status.value).toBe('pending')
    api.markClean()
    expect(api.status.value).toBe('clean')

    // 30s（乃至更久）不发生自动保存，状态保持 clean
    await vi.advanceTimersByTimeAsync(120000)
    expect(saveRemote).not.toHaveBeenCalled()
    expect(api.status.value).toBe('clean')

    // 恢复后用户手动编辑：仍正常计时保存
    api.notifyChanged()
    expect(api.status.value).toBe('pending')
    await vi.advanceTimersByTimeAsync(30000)
    expect(saveRemote).toHaveBeenCalledTimes(1)
    expect(api.status.value).toBe('clean')
  })

  it('行为锁②（修正 B 反转）：新文章卸载时内容非空 → 补写 localStorage 草稿（带 savedAt，再次进入可恢复）', async () => {
    // 用默认 saveLocal 验证 key/结构与定时器轨道一致
    const saveRemote = vi.fn()
    const { api, wrapper } = mountAutosave({
      articleId: ref(null),
      buildBody: () => BODY,
      saveRemote,
      delay: 30000
    })
    api.markInitialized()
    api.notifyChanged()

    // 10s 即离开（定时器未到点）：卸载补存走本地轨
    await vi.advanceTimersByTimeAsync(10000)
    await wrapper.unmount()
    expect(saveRemote).not.toHaveBeenCalled()
    const raw = localStorage.getItem(DRAFT_NEW_KEY)
    expect(raw).toBeTruthy()
    const draft = JSON.parse(raw)
    expect(draft.title).toBe('标题')
    expect(draft.content).toBe('正文')
    expect(typeof draft.savedAt).toBe('number')

    // 计时器随卸载清理：推进到 30s 之后不会重复写
    await vi.advanceTimersByTimeAsync(60000)

    // 再次进入可恢复：parseLocalDraft 能原样解析卸载补存的草稿
    expect(parseLocalDraft(raw)).toMatchObject({ title: '标题', content: '正文' })
  })
})
