import { describe, expect, it } from 'vitest'
import { readingIdentity, readingMinutes, readingPreferences } from '../useArticleReading'

const article = { id: 97, slug: 'old-name', title: 'title', content: '同一份正文', editorType: 'MARKDOWN', visible: true, visibility: 'PUBLIC' }

describe('阅读偏好与恢复条件', () => {
  it('以文章 ID 和内容修订识别位置，slug 和浏览次数变化不影响', () => {
    const original = readingIdentity(article)
    expect(readingIdentity({ ...article, slug: 'new-name', viewCount: 3 })).toEqual(original)
    expect(readingIdentity({ ...article, content: '另一份正文' }).revision).not.toBe(original.revision)
    expect(readingIdentity({ ...article, editorType: 'RICHTEXT' }).revision).not.toBe(original.revision)
    expect(original).toEqual({ id: '97', revision: expect.any(String) })
    expect(original.revision).not.toContain(article.content)
  })

  it('排除非公开、未到点和门禁内容', () => {
    for (const patch of [{ visibility: 'PRIVATE' }, { visibility: 'PASSWORD' }, { visible: false }, { passwordRequired: true }]) {
      expect(readingIdentity({ ...article, ...patch })).toBeNull()
    }
  })

  it('校验持久化的偏好，并按中英文阅读速度估算', () => {
    expect(readingPreferences({ theme: 'dark', size: 'invalid', spacing: 'relaxed' }))
      .toEqual({ theme: 'dark', size: 'normal', spacing: 'relaxed' })
    expect(readingPreferences(null)).toEqual({ theme: 'system', size: 'normal', spacing: 'normal' })
    expect(readingMinutes('字'.repeat(300) + ' word'.repeat(220))).toBe(2)
    expect(readingMinutes('')).toBe(1)
  })
})
