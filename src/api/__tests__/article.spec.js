import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock http 实例，断言请求路径/参数；blob 响应由 http 拦截器透传完整 resp
const http = {
  get: vi.fn(() => Promise.resolve()),
  post: vi.fn(() => Promise.resolve()),
  put: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve())
}

vi.mock('../http', () => ({ default: http }))

const { exportArticle, importArticle } = await import('../article')

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
    const vo = { id: 42, status: 'DRAFT', editorType: 'MARKDOWN' }
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
})
