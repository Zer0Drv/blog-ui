import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import NotificationsView from '../NotificationsView.vue'
import { pageNotifications, markRead, markAllRead } from '../../api/notification'
import { notifyUnreadChanged } from '../../utils/unreadSync'

// 捕获 realtime.on 注册的回调
const listeners = vi.hoisted(() => ({}))
const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: mocks.push, replace: vi.fn() })
}))

vi.mock('../../stores/realtime', () => ({
  useRealtimeStore: () => ({
    connected: false,
    on: (type, cb) => { listeners[type] = cb },
    off: (type, cb) => { if (listeners[type] === cb) delete listeners[type] },
    connect: vi.fn(),
    disconnect: vi.fn()
  })
}))

vi.mock('../../api/notification', () => ({
  pageNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn()
}))

vi.mock('../../api/upload', () => ({ resolveUploadUrl: v => v }))
vi.mock('../../utils/unreadSync', () => ({ notifyUnreadChanged: vi.fn() }))

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(NotificationsView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper }
}

describe('NotificationsView 已读后未读徽标同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(listeners).forEach(k => delete listeners[k])
    document.body.innerHTML = ''
    pageNotifications.mockResolvedValue({
      records: [
        { id: 1, type: 'COMMENT_REPLY', readFlag: 0, articleId: 10, actor: { id: 2, username: 'bob' } },
        { id: 2, type: 'FOLLOW', readFlag: 0, actor: { id: 3, username: 'cat' } }
      ],
      total: 2
    })
    markRead.mockResolvedValue(undefined)
    markAllRead.mockResolvedValue(undefined)
  })

  it('点击未读通知标记已读成功后广播 unread-changed', async () => {
    const { wrapper } = mountView()
    await flushPromises()
    expect(wrapper.findAll('.notify-item').length).toBe(2)

    await wrapper.findAll('.notify-item')[0].trigger('click')
    await flushPromises()

    expect(markRead).toHaveBeenCalledWith(1)
    expect(notifyUnreadChanged).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('点击已读通知不再标记，也不广播', async () => {
    pageNotifications.mockResolvedValue({
      records: [{ id: 3, type: 'SYSTEM', readFlag: 1, actor: null }],
      total: 1
    })
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.findAll('.notify-item')[0].trigger('click')
    await flushPromises()

    expect(markRead).not.toHaveBeenCalled()
    expect(notifyUnreadChanged).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('「全部已读」成功后广播 unread-changed', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const btn = wrapper.findAll('button').find(b => b.text().includes('全部已读'))
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    await flushPromises()

    expect(markAllRead).toHaveBeenCalledTimes(1)
    expect(notifyUnreadChanged).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

describe('NotificationsView ARTICLE_FORCE_DELETED 与断线轮询兜底', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(listeners).forEach(k => delete listeners[k])
    document.body.innerHTML = ''
    markRead.mockResolvedValue(undefined)
    markAllRead.mockResolvedValue(undefined)
  })

  it('渲染「删除了你的文章」+ 标题 summary，点击不跳转已删文章详情', async () => {
    pageNotifications.mockResolvedValue({
      records: [{
        id: 9,
        type: 'ARTICLE_FORCE_DELETED',
        readFlag: 1,
        actor: null,
        summary: '被删文章标题',
        articleId: 55
      }],
      total: 1
    })
    const { wrapper } = mountView()
    await flushPromises()

    const item = wrapper.find('.notify-item')
    expect(item.text()).toContain('系统')
    expect(item.text()).toContain('删除了你的文章')
    expect(item.text()).toContain('被删文章标题')

    // 文章已不存在：点击不跳转详情（已读项也不再标记）
    await item.trigger('click')
    await flushPromises()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(markRead).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('未读的强制删除通知点击后标记已读，但仍不跳转', async () => {
    pageNotifications.mockResolvedValue({
      records: [{ id: 10, type: 'ARTICLE_FORCE_DELETED', readFlag: 0, actor: null, summary: 't', articleId: 56 }],
      total: 1
    })
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.find('.notify-item').trigger('click')
    await flushPromises()
    expect(markRead).toHaveBeenCalledWith(10)
    expect(mocks.push).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('WS 断开时 5s 轮询兜底重拉通知列表（mock 通道 connected=false）', async () => {
    vi.useFakeTimers()
    pageNotifications.mockResolvedValue({ records: [], total: 0 })
    const { wrapper } = mountView()
    await flushPromises()
    expect(pageNotifications).toHaveBeenCalledTimes(1) // 挂载首拉

    // 兜底轮询只在 WS 断开时启用（mock 的 connected 恒为 false）
    await vi.advanceTimersByTimeAsync(4999)
    expect(pageNotifications).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(pageNotifications).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10000)
    expect(pageNotifications).toHaveBeenCalledTimes(4)

    // 卸载停止轮询
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(20000)
    expect(pageNotifications).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })
})
