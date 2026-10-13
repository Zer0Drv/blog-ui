import { describe, it, expect } from 'vitest'
import { articlePath } from '../articleLink'

describe('articlePath 文章站内链接（Zer0Drv/blog#14）', () => {
  it('优先 slug 固定链接', () => {
    expect(articlePath({ id: 7, slug: 'my-post' })).toBe('/article/my-post')
  })

  it('slug 缺失回退 id（旧数据 / 异常兜底）', () => {
    expect(articlePath({ id: 7 })).toBe('/article/7')
    expect(articlePath({ id: 7, slug: '' })).toBe('/article/7')
    expect(articlePath({ id: 7, slug: null })).toBe('/article/7')
  })
})
