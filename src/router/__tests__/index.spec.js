import { describe, it, expect } from 'vitest'
import router from '../index'

describe('router', () => {
  it('包含管理后台站点设置路由 /admin/site（仅 ADMIN）', () => {
    expect(router.hasRoute('admin-site')).toBe(true)
    const route = router.getRoutes().find(r => r.name === 'admin-site')
    expect(route.path).toBe('/admin/site')
    expect(route.meta.roles).toEqual(['ADMIN'])
  })

  it('文章详情双路由（Zer0Drv/blog#14）：数字走 id 路由，slug 走固定链接路由', () => {
    // 旧 id 路由保留且限定纯数字
    const byId = router.resolve('/article/123')
    expect(byId.name).toBe('article-detail')
    expect(byId.params.id).toBe('123')
    expect(byId.meta.public).toBe(true)

    // slug 固定链接路由（公开）
    const bySlug = router.resolve('/article/my-first-post')
    expect(bySlug.name).toBe('article-detail-slug')
    expect(bySlug.params.slug).toBe('my-first-post')
    expect(bySlug.meta.public).toBe(true)

    // 非法形态（大写 / 下划线）两条路由都不命中，落兜底重定向
    expect(router.resolve('/article/Hello_World').name).not.toBe('article-detail')
    expect(router.resolve('/article/Hello_World').name).not.toBe('article-detail-slug')
  })
})
