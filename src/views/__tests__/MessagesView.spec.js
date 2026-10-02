import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import MessagesView from '../MessagesView.vue'
import { useAuthStore } from '../../stores/auth'
import { listConversations, pageMessages, markConversationRead } from '../../api/message'
import { notifyUnreadChanged } from '../../utils/unreadSync'

// 捕获 realtime.on 注册的回调，用于模拟 WS 推送
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

vi.mock('../../api/message', () => ({
  listConversations: vi.fn(),
  pageMessages: vi.fn(),
  sendMessage: vi.fn(),
  markConversationRead: vi.fn()
}))

vi.mock('../../api/social', () => ({ getUserProfile: vi.fn() }))
vi.mock('../../api/upload', () => ({ resolveUploadUrl: v => v }))
vi.mock('../../utils/unreadSync', () => ({ notifyUnreadChanged: vi.fn() }))

function msg(id, senderId = 2) {
  return { id, senderId, receiverId: 1, content: `msg-${id}`, createTime: '2024-01-01T00:00:00' }
}

// 后端 create_time 倒序：[from, from+1, ..., to] -> [to, ..., from]
function descRange(from, to) {
  const list = []
  for (let i = to; i >= from; i--) list.push(msg(i))
  return list
}

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'me', role: 'USER' }
  const wrapper = mount(MessagesView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper, auth }
}

describe('MessagesView 实时推送与轮询兜底', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(listeners).forEach(k => delete listeners[k])
    document.body.innerHTML = ''
    listConversations.mockResolvedValue([
      { peer: { id: 2, username: 'bob' }, lastMessage: null, unreadCount: 1 }
    ])
    pageMessages.mockResolvedValue({ records: [], total: 0 })
    markConversationRead.mockResolvedValue(undefined)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('挂载不崩溃：注册 private_message 监听、加载会话并自动选中首个会话', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    expect(typeof listeners.private_message).toBe('function')
    expect(listConversations).toHaveBeenCalled()
    expect(wrapper.text()).toContain('bob')
    // 自动选中首个会话：拉第 1 页消息 + 标记已读
    expect(pageMessages).toHaveBeenCalledWith(2, 1, 20)
    expect(markConversationRead).toHaveBeenCalledWith(2)
    wrapper.unmount()
  })

  it('收到当前会话的实时私信：静默刷新消息并标记已读', async () => {
    const { wrapper } = mountView()
    await flushPromises()
    pageMessages.mockClear()
    markConversationRead.mockClear()

    listeners.private_message({ id: 99, senderId: 2, content: '在吗' })
    await flushPromises()

    expect(pageMessages).toHaveBeenCalledWith(2, 1, 20)
    expect(markConversationRead).toHaveBeenCalledWith(2)
    wrapper.unmount()
  })

  it('收到其他会话的实时私信：只刷新会话列表，不重拉消息', async () => {
    const { wrapper } = mountView()
    await flushPromises()
    listConversations.mockClear()
    pageMessages.mockClear()

    listeners.private_message({ id: 100, senderId: 3, content: '其他人' })
    await flushPromises()

    expect(listConversations).toHaveBeenCalled()
    expect(pageMessages).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('卸载后注销监听并停止轮询', async () => {
    const { wrapper } = mountView()
    await flushPromises()
    wrapper.unmount()

    expect(listeners.private_message).toBeUndefined()
  })

  it('进入会话标记已读成功后广播 unread-changed（导航栏即时刷新徽标）', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    // 挂载后自动选中首个会话并标记已读
    expect(markConversationRead).toHaveBeenCalledWith(2)
    expect(notifyUnreadChanged).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('收到当前会话实时私信并标记已读成功后广播 unread-changed', async () => {
    const { wrapper } = mountView()
    await flushPromises()
    notifyUnreadChanged.mockClear()

    listeners.private_message({ id: 99, senderId: 2, content: '在吗' })
    await flushPromises()

    expect(markConversationRead).toHaveBeenCalledWith(2)
    expect(notifyUnreadChanged).toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('MessagesView 加载更早的消息', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(listeners).forEach(k => delete listeners[k])
    document.body.innerHTML = ''
    listConversations.mockResolvedValue([
      { peer: { id: 2, username: 'bob' }, lastMessage: null, unreadCount: 0 }
    ])
    markConversationRead.mockResolvedValue(undefined)
    // 共 40 条：第 1 页 id 21~40（倒序），第 2 页 id 1~20（倒序）
    pageMessages.mockImplementation((peerId, page) => Promise.resolve({
      total: 40,
      records: page === 1 ? descRange(21, 40) : descRange(1, 20)
    }))
  })

  it('点击「加载更早的消息」：请求下一页并前插到消息头部（正序）', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.findAll('.msg-row').length).toBe(20)
    expect(wrapper.find('.load-more').exists()).toBe(true)

    await wrapper.find('.load-more button').trigger('click')
    await flushPromises()

    expect(pageMessages).toHaveBeenCalledWith(2, 2, 20)
    const rows = wrapper.findAll('.msg-row')
    expect(rows.length).toBe(40)
    // 更早的消息前插且保持正序：第一条是 msg-1
    expect(rows[0].text()).toContain('msg-1')
    expect(rows[19].text()).toContain('msg-20')
    expect(rows[20].text()).toContain('msg-21')
    wrapper.unmount()
  })

  it('全部加载完后不再显示「加载更早的消息」', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.find('.load-more button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.load-more').exists()).toBe(false)
    wrapper.unmount()
  })
})
