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
const friendlink = await import('../friendlink')
const admin = await import('../admin')

describe('api/friendlink（P1 公开友链，issue #17）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getFriendLinks → GET /friend-links', async () => {
    await friendlink.getFriendLinks()
    expect(http.get).toHaveBeenCalledWith('/friend-links')
  })
})

describe('api/admin（P1 友链管理，issue #17）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pageFriendLinks → GET /admin/friend-links（带分页/筛选参数）', async () => {
    const params = { page: 1, size: 20, keyword: 'foo', status: 1 }
    await admin.pageFriendLinks(params)
    expect(http.get).toHaveBeenCalledWith('/admin/friend-links', { params })
  })

  it('createFriendLink → POST /admin/friend-links', async () => {
    const payload = { name: 'Foo', url: 'https://foo.example', logo: '', description: '', sort: 1 }
    await admin.createFriendLink(payload)
    expect(http.post).toHaveBeenCalledWith('/admin/friend-links', payload)
  })

  it('updateFriendLink → PUT /admin/friend-links/{id}', async () => {
    const payload = { name: 'Bar', url: 'https://bar.example', logo: '', description: 'd', sort: 2 }
    await admin.updateFriendLink(7, payload)
    expect(http.put).toHaveBeenCalledWith('/admin/friend-links/7', payload)
  })

  it('setFriendLinkStatus → PUT /admin/friend-links/{id}/status', async () => {
    await admin.setFriendLinkStatus(7, 0)
    expect(http.put).toHaveBeenCalledWith('/admin/friend-links/7/status', { status: 0 })
  })

  it('deleteFriendLink → DELETE /admin/friend-links/{id}', async () => {
    await admin.deleteFriendLink(7)
    expect(http.delete).toHaveBeenCalledWith('/admin/friend-links/7')
  })
})
