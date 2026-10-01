import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRealtimeStore } from '../realtime'

// 假 WebSocket：记录实例，测试手动触发 open/message/close
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

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  // 模拟服务端断线
  serverClose() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

describe('realtime store', () => {
  beforeEach(() => {
    localStorage.clear()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function lastSocket() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  }

  it('connect 建连（同源 Cookie 鉴权），open 后 connected=true', () => {
    const realtime = useRealtimeStore()

    realtime.connect()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(lastSocket().url).toBe(`${location.origin.replace(/^http/, 'ws')}/ws`)
    expect(realtime.connected).toBe(false)

    lastSocket().open()
    expect(realtime.connected).toBe(true)
  })

  it('WS URL 不携带 token query（#13）', () => {
    const realtime = useRealtimeStore()
    realtime.connect()
    expect(lastSocket().url).not.toContain('token=')
  })

  it('已连接/连接中不重复建连', () => {
    const realtime = useRealtimeStore()

    realtime.connect()
    realtime.connect() // 连接中
    lastSocket().open()
    realtime.connect() // 已连接

    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('onmessage 按 type 分发给订阅者，off 后不再收到', () => {
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()

    const onMsg = vi.fn()
    const onNotify = vi.fn()
    realtime.on('private_message', onMsg)
    realtime.on('notification', onNotify)

    const message = { id: 1, senderId: 2, content: 'hi' }
    lastSocket().emit({ type: 'private_message', data: message })
    expect(onMsg).toHaveBeenCalledWith(message)
    expect(onNotify).not.toHaveBeenCalled()

    realtime.off('private_message', onMsg)
    lastSocket().emit({ type: 'private_message', data: message })
    expect(onMsg).toHaveBeenCalledTimes(1)

    lastSocket().emit('not-json{{{')
    lastSocket().emit({ data: 'no-type' })
    expect(onMsg).toHaveBeenCalledTimes(1)
    expect(onNotify).not.toHaveBeenCalled()
  })

  it('单个订阅者抛异常不影响其他订阅者', () => {
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()

    const bad = vi.fn(() => { throw new Error('boom') })
    const good = vi.fn()
    realtime.on('notification', bad)
    realtime.on('notification', good)

    lastSocket().emit({ type: 'notification', data: { id: 1 } })
    expect(bad).toHaveBeenCalled()
    expect(good).toHaveBeenCalledWith({ id: 1 })
  })

  it('断线后指数退避重连（1s→2s→4s→8s→16s，上限 5 次）', () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()
    expect(realtime.connected).toBe(true)

    // 第 1 次断线：1s 后重连
    lastSocket().serverClose()
    expect(realtime.connected).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(FakeWebSocket.instances).toHaveLength(2)

    // 重连的 socket 未 open 又断：2s 后再试
    lastSocket().serverClose()
    vi.advanceTimersByTime(1999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(3)

    // 依次 4s / 8s / 16s
    lastSocket().serverClose()
    vi.advanceTimersByTime(4000)
    expect(FakeWebSocket.instances).toHaveLength(4)
    lastSocket().serverClose()
    vi.advanceTimersByTime(8000)
    expect(FakeWebSocket.instances).toHaveLength(5)
    lastSocket().serverClose()
    vi.advanceTimersByTime(16000)
    expect(FakeWebSocket.instances).toHaveLength(6)

    // 已达 5 次上限，不再重连
    lastSocket().serverClose()
    vi.advanceTimersByTime(60000)
    expect(FakeWebSocket.instances).toHaveLength(6)
  })

  it('重连成功后重置退避计数', () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()

    lastSocket().serverClose()
    vi.advanceTimersByTime(1000)
    expect(FakeWebSocket.instances).toHaveLength(2)
    lastSocket().open() // 重连成功
    expect(realtime.connected).toBe(true)

    // 再断仍从 1s 起步
    lastSocket().serverClose()
    vi.advanceTimersByTime(999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it('disconnect 主动关闭不重连，并清掉待执行的重连定时器', () => {
    vi.useFakeTimers()
    const realtime = useRealtimeStore()
    realtime.connect()
    lastSocket().open()

    // 场景 1：连接中断线，重连定时器待执行时 disconnect
    lastSocket().serverClose()
    realtime.disconnect()
    vi.advanceTimersByTime(60000)
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(realtime.connected).toBe(false)

    // 场景 2：已连接时 disconnect，触发 onclose 也不重连
    realtime.connect()
    lastSocket().open()
    expect(realtime.connected).toBe(true)
    realtime.disconnect()
    vi.advanceTimersByTime(60000)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(realtime.connected).toBe(false)
  })
})
