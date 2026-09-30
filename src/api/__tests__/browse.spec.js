import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock http 实例，断言阅读侧接口的路径与参数
vi.mock('../http', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({})),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const http = (await import('../http')).default
const { searchArticles, getArchives } = await import('../browse')

describe('api/browse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searchArticles：GET /articles/search 透传 keyword/page/size', async () => {
    await searchArticles({ keyword: 'vue', page: 2, size: 10 })
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/articles/search', {
      params: { keyword: 'vue', page: 2, size: 10 }
    })
  })

  it('searchArticles：参数原样透传（未传 page 不补默认值）', async () => {
    await searchArticles({ keyword: '归档' })
    expect(http.get).toHaveBeenCalledWith('/articles/search', {
      params: { keyword: '归档' }
    })
  })

  it('getArchives：GET /articles/archives 无参数', async () => {
    await getArchives()
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/articles/archives')
  })

  it('返回值为 http.get 的 Promise 结果（拦截器已剥离 R 体）', async () => {
    const page = { records: [{ id: 1 }], total: 1 }
    http.get.mockResolvedValueOnce(page)
    await expect(searchArticles({ keyword: 'a', page: 1, size: 10 })).resolves.toBe(page)

    const months = [{ month: '2026-09', count: 2, articles: [] }]
    http.get.mockResolvedValueOnce(months)
    await expect(getArchives()).resolves.toBe(months)
  })
})
