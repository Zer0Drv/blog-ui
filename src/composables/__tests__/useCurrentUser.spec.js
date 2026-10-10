import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCurrentUser } from '../useCurrentUser'
import { useAuthStore } from '../../stores/auth'

// 防会话迁移触发真实 WebSocket 建连
vi.mock('../../stores/realtime', () => ({
  useRealtimeStore: () => ({ connect: vi.fn(), disconnect: vi.fn() })
}))

describe('useCurrentUser（视图唯一入口，#22）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('computed 全部转发自 auth store 并响应式联动', () => {
    const auth = useAuthStore()
    auth.sessionChecked = true // 模拟守卫已 resolve，避免 dev 警告
    const { user, isLoggedIn, isAdmin, canWrite } = useCurrentUser()

    expect(user.value).toBeNull()
    expect(isLoggedIn.value).toBe(false)
    expect(isAdmin.value).toBe(false)
    expect(canWrite.value).toBe(false)

    auth.user = { id: 1, username: 'neo', role: 'AUTHOR' }
    expect(user.value).toEqual({ id: 1, username: 'neo', role: 'AUTHOR' })
    expect(isLoggedIn.value).toBe(true)
    expect(isAdmin.value).toBe(false)
    expect(canWrite.value).toBe(true)

    auth.user = { id: 1, username: 'neo', role: 'ADMIN' }
    expect(isAdmin.value).toBe(true)
    expect(canWrite.value).toBe(true)

    auth.user = null
    expect(isLoggedIn.value).toBe(false)
  })

  it('hasRole / hasAnyRole 转发 store 的角色判断', () => {
    const auth = useAuthStore()
    auth.sessionChecked = true
    auth.user = { id: 1, role: 'AUTHOR' }
    const { hasRole, hasAnyRole } = useCurrentUser()

    expect(hasRole('AUTHOR')).toBe(true)
    expect(hasRole('ADMIN')).toBe(false)
    expect(hasAnyRole('ADMIN', 'AUTHOR')).toBe(true)
    expect(hasAnyRole('ADMIN')).toBe(false)
  })

  it('会话未就绪（sessionChecked=false）时 console.warn 提示契约', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const auth = useAuthStore()
    auth.sessionChecked = false

    useCurrentUser()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('会话尚未就绪')
    warn.mockRestore()
  })

  it('会话就绪时不告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const auth = useAuthStore()
    auth.sessionChecked = true

    useCurrentUser()

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
