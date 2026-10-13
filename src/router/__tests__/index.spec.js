import { describe, it, expect } from 'vitest'
import router from '../index'

describe('router', () => {
  it('包含管理后台站点设置路由 /admin/site（仅 ADMIN）', () => {
    expect(router.hasRoute('admin-site')).toBe(true)
    const route = router.getRoutes().find(r => r.name === 'admin-site')
    expect(route.path).toBe('/admin/site')
    expect(route.meta.roles).toEqual(['ADMIN'])
  })

  it('包含管理后台友情链接路由 /admin/friend-links（仅 ADMIN，issue #17）', () => {
    expect(router.hasRoute('admin-friend-links')).toBe(true)
    const route = router.getRoutes().find(r => r.name === 'admin-friend-links')
    expect(route.path).toBe('/admin/friend-links')
    expect(route.meta.roles).toEqual(['ADMIN'])
  })

  it('包含公众端友情链接页 /links（匿名可访问，issue #17）', () => {
    expect(router.hasRoute('friend-links')).toBe(true)
    const route = router.getRoutes().find(r => r.name === 'friend-links')
    expect(route.path).toBe('/links')
    expect(route.meta.public).toBe(true)
  })
})
