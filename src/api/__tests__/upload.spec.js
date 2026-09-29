import { describe, it, expect } from 'vitest'
import { resolveUploadUrl } from '../upload'

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
