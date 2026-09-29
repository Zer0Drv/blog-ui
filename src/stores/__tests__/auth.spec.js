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

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login 成功后写入 token + localStorage 并拉取用户信息', async () => {
    http.post.mockResolvedValue({ access_token: 'token-abc' })
    http.get.mockResolvedValue({ id: 1, username: 'neo' })
    const auth = useAuthStore()

    await auth.login('neo', 'secret')

    expect(http.post).toHaveBeenCalledWith('/auth/login', { username: 'neo', password: 'secret' })
    expect(auth.token).toBe('token-abc')
    expect(localStorage.getItem('token')).toBe('token-abc')
    expect(http.get).toHaveBeenCalledWith('/auth/me')
    expect(auth.user).toEqual({ id: 1, username: 'neo' })
    expect(auth.isLoggedIn).toBe(true)
  })

  it('login 失败时不写 token', async () => {
    http.post.mockRejectedValue(new Error('密码错误'))
    const auth = useAuthStore()

    await expect(auth.login('neo', 'bad')).rejects.toThrow()
    expect(auth.token).toBe('')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('setToken 直接写入 store 与 localStorage（OAuth 回跳）', () => {
    const auth = useAuthStore()
    auth.setToken('oauth-token')

    expect(auth.token).toBe('oauth-token')
    expect(localStorage.getItem('token')).toBe('oauth-token')
  })

  it('logout 清理 token、user 与 localStorage', async () => {
    http.post.mockResolvedValue({})
    const auth = useAuthStore()
    auth.setToken('t')
    auth.user = { id: 1 }

    await auth.logout()

    expect(http.post).toHaveBeenCalledWith('/auth/logout')
    expect(auth.token).toBe('')
    expect(auth.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logout 在后端报错时也允许本地登出', async () => {
    http.post.mockRejectedValue(new Error('401'))
    const auth = useAuthStore()
    auth.setToken('t')

    await auth.logout()

    expect(auth.token).toBe('')
    expect(localStorage.getItem('token')).toBeNull()
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
