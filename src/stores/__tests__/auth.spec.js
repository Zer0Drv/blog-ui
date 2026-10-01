import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import http from '../../api/http'
import { useAuthStore } from '../auth'

vi.mock('../../api/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// 防真实 WebSocket 建连：fetchMe 成功后会触发 realtime.connect()
vi.mock('../realtime', () => ({
  useRealtimeStore: () => ({ connect: vi.fn(), disconnect: vi.fn() })
}))

describe('auth store（Cookie 会话，#13）', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login 成功后不写本地 token，拉取 /auth/me 建立会话', async () => {
    http.post.mockResolvedValue({})
    http.get.mockResolvedValue({ id: 1, username: 'neo' })
    const auth = useAuthStore()

    await auth.login('neo', 'secret')

    expect(http.post).toHaveBeenCalledWith('/auth/login', { username: 'neo', password: 'secret' })
    expect(http.get).toHaveBeenCalledWith('/auth/me')
    expect(auth.user).toEqual({ id: 1, username: 'neo' })
    expect(auth.isLoggedIn).toBe(true)
    // 前端任何环节不再持有 token
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('login 失败时不建立登录态', async () => {
    http.post.mockRejectedValue(new Error('密码错误'))
    const auth = useAuthStore()

    await expect(auth.login('neo', 'bad')).rejects.toThrow()
    expect(auth.user).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('exchangeOAuthCode 用一次性 code 换 Cookie 会话并拉取用户信息', async () => {
    http.post.mockResolvedValue({})
    http.get.mockResolvedValue({ id: 2, username: 'octo' })
    const auth = useAuthStore()

    await auth.exchangeOAuthCode('code-123')

    expect(http.post).toHaveBeenCalledWith('/auth/oauth/exchange', { code: 'code-123' })
    expect(http.get).toHaveBeenCalledWith('/auth/me')
    expect(auth.user).toEqual({ id: 2, username: 'octo' })
    expect(auth.isLoggedIn).toBe(true)
  })

  it('exchangeOAuthCode 失败（code 过期/已使用）时不建立登录态', async () => {
    http.post.mockRejectedValue(new Error('401'))
    const auth = useAuthStore()

    await expect(auth.exchangeOAuthCode('bad-code')).rejects.toThrow()
    expect(auth.isLoggedIn).toBe(false)
  })

  it('ensureSession 首次调 /auth/me 恢复会话，之后幂等', async () => {
    http.get.mockResolvedValue({ id: 1, username: 'neo' })
    const auth = useAuthStore()

    await auth.ensureSession()
    await auth.ensureSession()

    expect(http.get).toHaveBeenCalledTimes(1)
    expect(auth.isLoggedIn).toBe(true)
  })

  it('ensureSession 遇到 401 视为未登录且不抛错', async () => {
    http.get.mockRejectedValue(new Error('401'))
    const auth = useAuthStore()

    await expect(auth.ensureSession()).resolves.toBeUndefined()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.sessionChecked).toBe(true)
  })

  it('logout 调用 /auth/logout 并清理本地状态', async () => {
    http.post.mockResolvedValue({})
    const auth = useAuthStore()
    auth.user = { id: 1 }

    await auth.logout()

    expect(http.post).toHaveBeenCalledWith('/auth/logout')
    expect(auth.user).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logout 在后端报错时也允许本地登出', async () => {
    http.post.mockRejectedValue(new Error('401'))
    const auth = useAuthStore()
    auth.user = { id: 1 }

    await auth.logout()

    expect(auth.user).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
  })

  it('sendResetCode / resetPassword 调用正确端点', async () => {
    http.post.mockResolvedValue({})
    const auth = useAuthStore()

    await auth.sendResetCode('a@b.com')
    expect(http.post).toHaveBeenCalledWith('/auth/password-reset-code', { email: 'a@b.com' })

    await auth.resetPassword({ email: 'a@b.com', code: '123456', newPassword: 'newpass' })
    expect(http.post).toHaveBeenCalledWith('/auth/password-reset', {
      email: 'a@b.com',
      code: '123456',
      newPassword: 'newpass'
    })
  })
})
