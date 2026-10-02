import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import NotificationsView from '../NotificationsView.vue'
import { pageNotifications, markRead, markAllRead } from '../../api/notification'
import { notifyUnreadChanged } from '../../utils/unreadSync'

// 捕获 realtime.on 注册的回调
const listeners = vi.hoisted(() => ({}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
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
