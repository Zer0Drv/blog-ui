import { describe, it, expect } from 'vitest'
import router from '../index'

describe('router', () => {
  it('包含管理后台站点设置路由 /admin/site（仅 ADMIN）', () => {
    expect(router.hasRoute('admin-site')).toBe(true)
    const route = router.getRoutes().find(r => r.name === 'admin-site')
    expect(route.path).toBe('/admin/site')
    expect(route.meta.roles).toEqual(['ADMIN'])
  })
})
