import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadArticleMetadata, resetArticleMetadata } from '../articleMetadata'

const response = html => ({ ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => html })
afterEach(() => { resetArticleMetadata(); vi.unstubAllGlobals() })

describe('文章分享 metadata', () => {
  it('复制匿名原始 HTML 的 metadata，保留可信 canonical 且不插入脚本/事件', async () => {
    const fetcher = vi.fn().mockResolvedValue(response('<head><meta property="og:title" content="新文章" onload="evil()"><link rel="canonical" href="https://blog.example/article/new"><script>evil()</script></head>'))
    vi.stubGlobal('fetch', fetcher)
    await loadArticleMetadata('new')
    expect(fetcher).toHaveBeenCalledWith('/api/article/new', expect.objectContaining({ credentials: 'omit', cache: 'no-store' }))
    expect(document.querySelector('meta[property="og:title"]').content).toBe('新文章')
    expect(document.querySelector('link[rel="canonical"]').href).toBe('https://blog.example/article/new')
    expect(document.head.querySelector('script, [onload]')).toBeNull()
  })
  it('切换到受限文章清除旧标题、canonical，并采用通用 noindex', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response('<meta property="og:title" content="旧文章"><link rel="canonical" href="https://blog.example/article/old">'))
      .mockResolvedValueOnce(response('<meta name="robots" content="noindex, nofollow"><meta property="og:title" content="Blog">')))
    await loadArticleMetadata('old')
    await loadArticleMetadata('private')
    expect(document.head.innerHTML).not.toContain('旧文章')
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow')
  })
  it('离开文章后忽略延迟响应，网络错误也不会留下上篇 metadata', async () => {
    let resolve
    vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done })))
    const loading = loadArticleMetadata('old')
    resetArticleMetadata()
    resolve(response('<meta property="og:title" content="迟到">'))
    await loading
    expect(document.head.innerHTML).not.toContain('迟到')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await loadArticleMetadata('next')
    expect(document.querySelector('meta[property="og:title"]').content).toBe('Blog')
  })
})
