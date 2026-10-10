import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import http from '../../api/http'
import { useAuthStore, CAPTCHA_REQUIRED_CODE } from '../auth'

vi.mock('../../api/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// 防真实 WebSocket 建连：会话迁移（_applyUser）会触发 realtime.connect/disconnect
const realtimeMock = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn() }))
vi.mock('../realtime', () => ({
  useRealtimeStore: () => realtimeMock
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

    await auth.login({ username: 'neo', password: 'secret' })

    expect(http.post).toHaveBeenCalledWith('/auth/login', { username: 'neo', password: 'secret' })
    expect(http.get).toHaveBeenCalledWith('/auth/me')
    expect(auth.user).toEqual({ id: 1, username: 'neo' })
    expect(auth.isLoggedIn).toBe(true)
    expect(auth.status).toBe('authenticated')
    // 前端任何环节不再持有 token
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('login 透传验证码字段（captchaId/captchaCode）', async () => {
    http.post.mockResolvedValue({})
    http.get.mockResolvedValue({ id: 1, username: 'neo' })
    const auth = useAuthStore()

    await auth.login({ username: 'neo', password: 'secret', captchaId: 'cid-1', captchaCode: 'ab12' })

    expect(http.post).toHaveBeenCalledWith('/auth/login', {
      username: 'neo',
      password: 'secret',
      captchaId: 'cid-1',
      captchaCode: 'ab12'
    })
  })

  it('login 触发验证码时 reject 且 err.code === CAPTCHA_REQUIRED_CODE', async () => {
    const err = Object.assign(new Error('操作过于频繁，请先完成验证'), { code: CAPTCHA_REQUIRED_CODE })
    http.post.mockRejectedValue(err)
    const auth = useAuthStore()

    await expect(auth.login({ username: 'neo', password: 'secret' })).rejects.toBe(err)
    expect(auth.user).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
    expect(http.get).not.toHaveBeenCalled()
  })

  it('login 失败时不建立登录态', async () => {
    http.post.mockRejectedValue(new Error('密码错误'))
    const auth = useAuthStore()

    await expect(auth.login({ username: 'neo', password: 'bad' })).rejects.toThrow()
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
    expect(auth.status).toBe('authenticated')
  })

  it('ensureSession 遇到 401 视为未登录且不抛错', async () => {
    http.get.mockRejectedValue(new Error('401'))
    const auth = useAuthStore()

    await expect(auth.ensureSession()).resolves.toBeUndefined()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.sessionChecked).toBe(true)
    expect(auth.status).toBe('anonymous')
  })

  it('logout 调用 /auth/logout 并清理本地状态', async () => {
    http.post.mockResolvedValue({})
    const auth = useAuthStore()
    auth.user = { id: 1 }

    await auth.logout()

    expect(http.post).toHaveBeenCalledWith('/auth/logout')
    expect(auth.user).toBeNull()
    expect(auth.isLoggedIn).toBe(false)
    expect(auth.status).toBe('anonymous')
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

  it('expireSession 置 expired 并清理用户态（401 出口回调用）', () => {
    const auth = useAuthStore()
    auth.user = { id: 1 }

    auth.expireSession()

    expect(auth.user).toBeNull()
    expect(auth.status).toBe('expired')
    expect(auth.sessionChecked).toBe(true)
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

describe('auth store 会话迁移点 _applyUser（#22）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('null→user 触发 realtime.connect()', () => {
    const auth = useAuthStore()
    auth._applyUser({ id: 1, username: 'neo' })

    expect(realtimeMock.connect).toHaveBeenCalledTimes(1)
    expect(realtimeMock.disconnect).not.toHaveBeenCalled()
    expect(auth.status).toBe('authenticated')
  })

  it('user→null 触发 realtime.disconnect()', () => {
    const auth = useAuthStore()
    auth._applyUser({ id: 1, username: 'neo' })
    vi.clearAllMocks()

    auth._applyUser(null)

    expect(realtimeMock.disconnect).toHaveBeenCalledTimes(1)
    expect(realtimeMock.connect).not.toHaveBeenCalled()
    expect(auth.status).toBe('anonymous')
  })

  it('user→user（资料刷新）不重复建连', () => {
    const auth = useAuthStore()
    auth._applyUser({ id: 1, username: 'neo' })
    vi.clearAllMocks()

    auth._applyUser({ id: 1, username: 'neo', nickname: '新昵称' })

    expect(realtimeMock.connect).not.toHaveBeenCalled()
    expect(realtimeMock.disconnect).not.toHaveBeenCalled()
    expect(auth.user.nickname).toBe('新昵称')
  })

  it('null→null 无动作（幂等）', () => {
    const auth = useAuthStore()
    auth._applyUser(null)

    expect(realtimeMock.connect).not.toHaveBeenCalled()
    expect(realtimeMock.disconnect).not.toHaveBeenCalled()
  })

  it('login/ensureSession/logout 全链路经 _applyUser 迁移 WS', async () => {
    http.post.mockResolvedValue({})
    http.get.mockResolvedValue({ id: 1, username: 'neo' })
    const auth = useAuthStore()

    await auth.login({ username: 'neo', password: 'secret' })
    expect(realtimeMock.connect).toHaveBeenCalledTimes(1)

    await auth.logout()
    expect(realtimeMock.disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('auth store 角色 getter（#22）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('isAdmin / canWrite / hasRole / hasAnyRole 按角色计算', () => {
    const auth = useAuthStore()
    expect(auth.isAdmin).toBe(false)
    expect(auth.canWrite).toBe(false)
    expect(auth.hasAnyRole('ADMIN', 'AUTHOR')).toBe(false)

    auth.user = { id: 1, role: 'ADMIN' }
    expect(auth.isAdmin).toBe(true)
    expect(auth.canWrite).toBe(true)
    expect(auth.hasRole('ADMIN')).toBe(true)
    expect(auth.hasAnyRole('ADMIN', 'AUTHOR')).toBe(true)

    auth.user = { id: 2, role: 'AUTHOR' }
    expect(auth.isAdmin).toBe(false)
    expect(auth.canWrite).toBe(true)
    expect(auth.hasAnyRole('ADMIN')).toBe(false)

    auth.user = { id: 3, role: 'USER' }
    expect(auth.isAdmin).toBe(false)
    expect(auth.canWrite).toBe(false)
  })
})
