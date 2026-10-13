import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock http 实例，断言请求路径/参数；blob 响应由 http 拦截器透传完整 resp
const http = {
  get: vi.fn(() => Promise.resolve()),
  post: vi.fn(() => Promise.resolve()),
  put: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve())
}

vi.mock('../http', () => ({ default: http }))

const { exportArticle, exportArticlesZip, importArticle, getArticleBySlug, getArticle, verifyArticlePassword } = await import('../article')

it('文章访问令牌仅在详情请求头传递，口令经 POST 校验', async () => {
  await getArticle(7, 'grant')
  expect(http.get).toHaveBeenLastCalledWith('/articles/7', { headers: { 'X-Article-Access-Token': 'grant' } })
  await getArticleBySlug('secret-post', 'grant')
  expect(http.get).toHaveBeenLastCalledWith('/articles/slug/secret-post', { headers: { 'X-Article-Access-Token': 'grant' } })
  await verifyArticlePassword(7, { password: 'secret' })
  expect(http.post).toHaveBeenLastCalledWith('/articles/7/password', { password: 'secret' })
})

describe('article 导入导出 api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 无 createObjectURL，补 stub
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  it('exportArticle 以 blob 请求并带 format 参数', async () => {
    http.get.mockResolvedValue({ data: new Blob(['# hi']), headers: {} })
    await exportArticle(7, 'md')
    expect(http.get).toHaveBeenCalledWith('/articles/7/export', {
      params: { format: 'md' },
      responseType: 'blob'
    })
  })

  it('exportArticle 从 Content-Disposition 解析 RFC 5987 文件名并触发下载', async () => {
    http.get.mockResolvedValue({
      data: new Blob(['# 标题']),
      headers: { 'content-disposition': "attachment; filename*=UTF-8''%E6%88%91%E7%9A%84%E6%96%87%E7%AB%A0.md" }
    })
    const clicked = {}
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.download = this.download
      clicked.href = this.href
    })

    await exportArticle(7, 'md')

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clicked.download).toBe('我的文章.md')
    expect(clicked.href).toBe('blob:mock-url')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('exportArticle 无 Content-Disposition 时回退默认文件名', async () => {
    http.get.mockResolvedValue({ data: new Blob(['<p>x</p>']), headers: {} })
    const clicked = {}
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.download = this.download
    })

    await exportArticle(9, 'html')
    expect(clicked.download).toBe('article-9.html')
  })

  it('importArticle 以 multipart FormData 提交 file 字段并返回 data', async () => {
    const vo = { imported: [{ id: 42, title: 'hello', warnings: [], externalImages: [] }], failed: [] }
    http.post.mockResolvedValue(vo)
    const file = new File(['# hello'], 'hello.md', { type: 'text/markdown' })

    const data = await importArticle(file)

    expect(data).toBe(vo)
    expect(http.post).toHaveBeenCalledTimes(1)
    const [url, body] = http.post.mock.calls[0]
    expect(url).toBe('/articles/import')
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('file')).toBe(file)
  })

  it('getArticleBySlug 请求 slug 固定链接详情（Zer0Drv/blog#14）', async () => {
    http.get.mockResolvedValue({ id: 7, slug: 'my-post' })

    await getArticleBySlug('my-post')

    expect(http.get).toHaveBeenCalledWith('/articles/slug/my-post')
  })

  it('exportArticlesZip 以 blob 请求 /articles/export 并逗号拼接 ids', async () => {
    http.get.mockResolvedValue({ data: new Blob(['PK']), headers: {} })
    const clicked = {}
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.download = this.download
    })

    await exportArticlesZip([1, 2, 3])

    expect(http.get).toHaveBeenCalledWith('/articles/export', {
      params: { ids: '1,2,3' },
      responseType: 'blob'
    })
    // 无 Content-Disposition 时回退默认 zip 文件名
    expect(clicked.download).toBe('articles-export.zip')
  })

  it('exportArticlesZip 从 Content-Disposition 解析文件名', async () => {
    http.get.mockResolvedValue({
      data: new Blob(['PK']),
      headers: { 'content-disposition': "attachment; filename*=UTF-8''articles-export.zip" }
    })
    const clicked = {}
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.download = this.download
    })

    await exportArticlesZip([7])
    expect(clicked.download).toBe('articles-export.zip')
  })
})
