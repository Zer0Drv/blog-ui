import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ElMessage } from 'element-plus'

// 守卫必经 auth.ensureSession() → GET /auth/me：mock http 层按用例控制登录态，
// 避免 jsdom 真实网络请求（realtime.connect 在无 WebSocket 环境下静默跳过）
vi.mock('../../api/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

vi.mock('element-plus', async importOriginal => {
  const mod = await importOriginal()
  return { ...mod, ElMessage: { ...mod.ElMessage, warning: vi.fn() } }
})

import http from '../../api/http'
import router from '../index'
import { useAuthStore } from '../../stores/auth'

describe('路由守卫分支（Cookie 会话，#22）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('已登录访问 /login 回跳首页', async () => {
    http.get.mockResolvedValue({ id: 1, username: 'neo', role: 'USER' })

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('public 页面未登录放行', async () => {
    http.get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('home')
    expect(useAuthStore().isLoggedIn).toBe(false)
  })

  it('未登录访问需登录页跳登录页', async () => {
    http.get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    await router.push('/settings')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('meta.roles 拒绝：非写作者访问 /my/articles 回首页并提示', async () => {
    http.get.mockResolvedValue({ id: 1, username: 'neo', role: 'USER' })

    await router.push('/my/articles')

    expect(router.currentRoute.value.name).toBe('home')
    expect(ElMessage.warning).toHaveBeenCalledWith('无权限访问该页面')
  })

  it('meta.roles 放行：AUTHOR 可访问 /my/articles', async () => {
    http.get.mockResolvedValue({ id: 1, username: 'neo', role: 'AUTHOR' })

    await router.push('/my/articles')

    expect(router.currentRoute.value.name).toBe('my-articles')
  })

  it('meta.roles 放行：ADMIN 可访问 /admin', async () => {
    http.get.mockResolvedValue({ id: 1, username: 'neo', role: 'ADMIN' })

    await router.push('/admin')

    expect(router.currentRoute.value.name).toBe('admin-dashboard')
  })
})
