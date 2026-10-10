import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useRealtimeStore } from '../../stores/realtime'
import { useRealtimeTopic } from '../useRealtimeTopic'

// 假 WebSocket：记录实例，测试手动触发 open/close（沿用 realtime.spec.js 模式）
class FakeWebSocket {
  static instances = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = FakeWebSocket.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  emit(payload) {
    this.onmessage?.({ data: typeof payload === 'string' ? payload : JSON.stringify(payload) })
  }

  // 模拟服务端断线
  serverClose() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

function lastSocket() {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
}

// 可控的页面可见性
let pageHidden = false

function setPageHidden(hidden) {
  pageHidden = hidden
  document.dispatchEvent(new Event('visibilitychange'))
}

// 挂载一个最小组件承载 useRealtimeTopic，渲染 connected 便于断言
function mountTopic(opts, { type = 'notification', onPush = vi.fn() } = {}) {
  const Comp = defineComponent({
    setup() {
      const { connected } = useRealtimeTopic(type, onPush, opts)
      return () => h('div', String(connected.value))
    }
  })
  return { wrapper: mount(Comp, { attachTo: document.body }), onPush }
}

describe('useRealtimeTopic', () => {
  beforeEach(() => {
    pageHidden = false
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (pageHidden ? 'hidden' : 'visible')
    })
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('挂载订阅、卸载退订；connected 透传实时通道状态', async () => {
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()

    const { wrapper, onPush } = mountTopic({ poll: null })
    expect(wrapper.text()).toBe('true') // connected 透传

    lastSocket().emit({ type: 'notification', data: { id: 1 } })
    expect(onPush).toHaveBeenCalledWith({ id: 1 })

    wrapper.unmount()
    lastSocket().emit({ type: 'notification', data: { id: 2 } })
    expect(onPush).toHaveBeenCalledTimes(1)
  })

  it('mode=fallback（默认）：WS 断开才按 interval 轮询', () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect() // CONNECTING 即未连接，视同断开
    const poll = vi.fn()

    const { wrapper } = mountTopic({ poll, interval: 5000 })

    vi.advanceTimersByTime(4999)
    expect(poll).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(poll).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10000)
    expect(poll).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('mode=fallback：连上即停轮询，再断开恢复轮询', async () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect()
    const poll = vi.fn()
    const { wrapper } = mountTopic({ poll, interval: 5000 })

    vi.advanceTimersByTime(5000)
    expect(poll).toHaveBeenCalledTimes(1)

    // 连上：watch(connected) 停掉轮询
    lastSocket().open()
    await nextTick()
    vi.advanceTimersByTime(15000)
    expect(poll).toHaveBeenCalledTimes(1)

    // 再断开：恢复 5s 轮询（重连定时器不影响节奏断言）
    lastSocket().serverClose()
    await nextTick()
    vi.advanceTimersByTime(5000)
    expect(poll).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('poll: null = 显式不要轮询兜底，断开也不起定时器', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const realtime = useRealtimeStore()
    realtime.connect()

    const { wrapper } = mountTopic({ poll: null })
    vi.advanceTimersByTime(60000)

    expect(setIntervalSpy).not.toHaveBeenCalled()
    wrapper.unmount()
    setIntervalSpy.mockRestore()
  })

  it("mode='always'：WS 已连接也始终轮询", async () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()
    await nextTick()
    expect(realtime.connected).toBe(true)

    const poll = vi.fn()
    const { wrapper } = mountTopic({ poll, interval: 5000, mode: 'always' })

    vi.advanceTimersByTime(15000)
    expect(poll).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('pauseWhenHidden：页面隐藏暂停轮询，恢复可见立即补一次并恢复节奏', () => {
    vi.useFakeTimers()
    const poll = vi.fn()
    const { wrapper } = mountTopic({ poll, interval: 5000, mode: 'always', pauseWhenHidden: true })

    vi.advanceTimersByTime(5000)
    expect(poll).toHaveBeenCalledTimes(1)

    // 隐藏：暂停
    setPageHidden(true)
    vi.advanceTimersByTime(20000)
    expect(poll).toHaveBeenCalledTimes(1)

    // 恢复可见：立即补一次 + 恢复 5s 节奏
    setPageHidden(false)
    expect(poll).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10000)
    expect(poll).toHaveBeenCalledTimes(4)
    wrapper.unmount()
  })

  it('隐藏状态下挂载不立即起轮询，恢复可见才开始', () => {
    vi.useFakeTimers()
    pageHidden = true
    const poll = vi.fn()
    const { wrapper } = mountTopic({ poll, interval: 5000, mode: 'always', pauseWhenHidden: true })

    vi.advanceTimersByTime(20000)
    expect(poll).not.toHaveBeenCalled()

    setPageHidden(false)
    expect(poll).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('卸载停止轮询并移除 visibilitychange 监听', async () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect()
    const poll = vi.fn()
    const { wrapper } = mountTopic({ poll, interval: 5000, pauseWhenHidden: true })

    wrapper.unmount()
    vi.advanceTimersByTime(30000)
    expect(poll).not.toHaveBeenCalled()

    // 卸载后可见性变化不再触发补拉
    setPageHidden(true)
    setPageHidden(false)
    await flushPromises()
    expect(poll).not.toHaveBeenCalled()
  })
})
