import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock http 实例，断言各接口的路径与参数（参照 http.spec.js 的 mock 范式）
vi.mock('../http', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({})),
    post: vi.fn(() => Promise.resolve({})),
    put: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({}))
  }
}))

const http = (await import('../http')).default
const site = await import('../site')
const admin = await import('../admin')
const user = await import('../user')

describe('api/site', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getSiteConfig → GET /site/config', async () => {
    await site.getSiteConfig()
    expect(http.get).toHaveBeenCalledWith('/site/config')
  })
})

describe('api/admin（P0 评论审核/回收站/站点配置）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approveComment → PUT /admin/comments/{id}/approve', async () => {
    await admin.approveComment(7)
    expect(http.put).toHaveBeenCalledWith('/admin/comments/7/approve')
  })

  it('rejectComment → PUT /admin/comments/{id}/reject', async () => {
    await admin.rejectComment(8)
    expect(http.put).toHaveBeenCalledWith('/admin/comments/8/reject')
  })

  it('restoreComment → POST /admin/comments/{id}/restore', async () => {
    await admin.restoreComment(9)
    expect(http.post).toHaveBeenCalledWith('/admin/comments/9/restore')
  })

  it('forceDeleteComment → DELETE /admin/comments/{id}/force', async () => {
    await admin.forceDeleteComment(10)
    expect(http.delete).toHaveBeenCalledWith('/admin/comments/10/force')
  })

  it('getAdminSiteConfig → GET /admin/site/config', async () => {
    await admin.getAdminSiteConfig()
    expect(http.get).toHaveBeenCalledWith('/admin/site/config')
  })

  it('saveAdminSiteConfig → PUT /admin/site/config（body 为 7 键 map）', async () => {
    const values = {
      'site.name': 'Blog',
      'site.description': '记录与分享',
      'site.logo': '',
      'site.icp': '',
      'site.footer': '',
      'site.base_url': 'http://localhost:5173',
      'comment.review_required': 'false'
    }
    await admin.saveAdminSiteConfig(values)
    expect(http.put).toHaveBeenCalledWith('/admin/site/config', values)
  })
})

describe('api/user（P0 通知偏好）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMyPreferences → GET /users/me/preferences', async () => {
    await user.getMyPreferences()
    expect(http.get).toHaveBeenCalledWith('/users/me/preferences')
  })

  it('updateMyPreferences → PUT /users/me/preferences { emailNotifyEnabled }', async () => {
    await user.updateMyPreferences({ emailNotifyEnabled: false })
    expect(http.put).toHaveBeenCalledWith('/users/me/preferences', { emailNotifyEnabled: false })
  })
})
