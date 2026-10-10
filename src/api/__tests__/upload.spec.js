import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveUploadUrl, uploadAndResolveUrl } from '../upload'
import http from '../http'

vi.mock('../http', () => ({
  default: { post: vi.fn() }
}))

describe('resolveUploadUrl', () => {
  it('绝对 http/https URL 原样返回', () => {
    expect(resolveUploadUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(resolveUploadUrl('http://example.com/uploads/a.png')).toBe('http://example.com/uploads/a.png')
  })

  it('/uploads 开头补 /api 前缀', () => {
    expect(resolveUploadUrl('/uploads/202401/abc.png')).toBe('/api/uploads/202401/abc.png')
    expect(resolveUploadUrl('/avatar/u1.png')).toBe('/api/avatar/u1.png')
  })

  it('空值返回空字符串', () => {
    expect(resolveUploadUrl('')).toBe('')
    expect(resolveUploadUrl(null)).toBe('')
    expect(resolveUploadUrl(undefined)).toBe('')
  })

  it('data:/blob: URL 原样返回', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo='
    expect(resolveUploadUrl(data)).toBe(data)
    expect(resolveUploadUrl('blob:http://localhost:5173/uuid')).toBe('blob:http://localhost:5173/uuid')
  })

  it('非斜杠开头的相对路径原样返回', () => {
    expect(resolveUploadUrl('uploads/a.png')).toBe('uploads/a.png')
  })
})

describe('uploadAndResolveUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('上传成功返回补过 /api 前缀的可展示 URL', async () => {
    http.post.mockResolvedValue({ url: '/uploads/202401/abc.png' })
    const file = new File(['x'], 'abc.png', { type: 'image/png' })

    await expect(uploadAndResolveUrl(file)).resolves.toBe('/api/uploads/202401/abc.png')
    expect(http.post).toHaveBeenCalledTimes(1)
    const [path, body] = http.post.mock.calls[0]
    expect(path).toBe('/upload/image')
    expect(body.get('file')).toBe(file)
  })

  it('上传失败时抛错（拦截器已提示，调用方兜底）', async () => {
    http.post.mockRejectedValue(new Error('网络错误'))
    await expect(uploadAndResolveUrl(new File(['x'], 'a.png'))).rejects.toThrow('网络错误')
  })
})
