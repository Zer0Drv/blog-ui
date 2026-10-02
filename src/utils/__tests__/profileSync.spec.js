import { describe, it, expect, vi } from 'vitest'
import { notifyProfileUpdated, onProfileUpdated } from '../profileSync'

describe('profileSync（资料变更同步）', () => {
  it('notifyProfileUpdated 触发本地 blog:profile-updated 事件', () => {
    const cb = vi.fn()
    const off = onProfileUpdated(cb)
    notifyProfileUpdated()
    expect(cb).toHaveBeenCalledTimes(1)
    off()
  })

  it('返回的注销函数生效：注销后不再收到事件', () => {
    const cb = vi.fn()
    const off = onProfileUpdated(cb)
    off()
    notifyProfileUpdated()
    expect(cb).not.toHaveBeenCalled()
  })

  it('无 BroadcastChannel 环境下降级不报错', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    vi.resetModules()
    const mod = await import('../profileSync')
    expect(() => mod.notifyProfileUpdated()).not.toThrow()
    const off = mod.onProfileUpdated(() => {})
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
    const mod = await import('../profileSync')
    const cb = vi.fn()
    mod.onProfileUpdated(cb)
    expect(instances.length).toBe(1)
    // 模拟其他标签页广播到达
    instances[0].onmessage({ data: { type: 'profile-updated' } })
    expect(cb).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    vi.resetModules()
  })
})
