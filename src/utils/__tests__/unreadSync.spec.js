import { describe, it, expect, vi } from 'vitest'
import { notifyUnreadChanged, onUnreadChanged } from '../unreadSync'

describe('unreadSync（未读徽标同步）', () => {
  it('notifyUnreadChanged 触发本地 blog:unread-changed 事件', () => {
    const cb = vi.fn()
    const off = onUnreadChanged(cb)
    notifyUnreadChanged()
    expect(cb).toHaveBeenCalledTimes(1)
    off()
  })

  it('返回的注销函数生效：注销后不再收到事件', () => {
    const cb = vi.fn()
    const off = onUnreadChanged(cb)
    off()
    notifyUnreadChanged()
    expect(cb).not.toHaveBeenCalled()
  })

  it('无 BroadcastChannel 环境下降级不报错', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    vi.resetModules()
    const mod = await import('../unreadSync')
    expect(() => mod.notifyUnreadChanged()).not.toThrow()
    const off = mod.onUnreadChanged(() => {})
    expect(() => off()).not.toThrow()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('收到 BroadcastChannel 广播后转发为本地事件', async () => {
    const instances = []
    vi.stubGlobal('BroadcastChannel', class {
      constructor() { this.onmessage = null; instances.push(this) }
      postMessage() {}
      close() {}
    })
    vi.resetModules()
    const mod = await import('../unreadSync')
    const cb = vi.fn()
    mod.onUnreadChanged(cb)
    expect(instances.length).toBe(1)
    // 模拟其他标签页广播到达
    instances[0].onmessage({ data: { type: 'unread-changed' } })
    expect(cb).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    vi.resetModules()
  })
})
