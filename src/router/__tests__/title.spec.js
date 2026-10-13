import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Cookie 会话（#13）下路由守卫首次导航必经 auth.ensureSession() → GET /auth/me：
// mock http 层让其 401 拒绝，等价于「未登录」；避免 jsdom 真实网络请求
vi.mock('../../api/http', () => ({
  default: {
    get: vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } })),
    post: vi.fn().mockRejectedValue(new Error('Unauthorized'))
  }
}))

import router from '../index'

// 路由页签标题：afterEach 将 to.meta.title 组合为 `<页面标题> - <站点名>`
// 未拉取站点配置时使用兜底站点名 Blog（main.js 的 ensureSiteConfig 不在测试链路中）
describe('router 页签标题（afterEach）', () => {
  beforeEach(() => {
    // 守卫无条件 useAuthStore()，需要活动 pinia 实例
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('meta.title 存在：/ → 首页 - Blog', async () => {
    await router.push('/')
    expect(document.title).toBe('首页 - Blog')
  })

  it('meta.title 存在：/login → 登录 - Blog', async () => {
    await router.push('/login')
    expect(document.title).toBe('登录 - Blog')
  })

  it('meta.title 存在：/archives → 归档 - Blog', async () => {
    await router.push('/archives')
    expect(document.title).toBe('归档 - Blog')
  })

  it('文章详情路由占位标题：/article/1 → 文章详情 - Blog', async () => {
    await router.push('/article/1')
    expect(document.title).toBe('文章详情 - Blog')
  })
  it('自定义页面公开可访问并设置占位标题', async () => {
    await router.push('/pages/about')
    expect(router.currentRoute.value.name).toBe('page-detail')
    expect(document.title).toBe('页面 - Blog')
  })

  it('未知路径重定向到首页后套用首页标题', async () => {
    await router.push('/no-such-page')
    expect(document.title).toBe('首页 - Blog')
  })

  it('未登录访问受限页被重定向到登录页，标题随之切换', async () => {
    await router.push('/settings')
    expect(document.title).toBe('登录 - Blog')
  })
})
