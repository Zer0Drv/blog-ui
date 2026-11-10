import { describe, expect, it } from 'vitest'
import { articleVersionDiff } from '../articleVersionDiff'

const version = (content, editorType = 'MARKDOWN') => ({ content, editorType })

describe('articleVersionDiff', () => {
  it('keeps unchanged lines in order and detects changes on either side', () => {
    const result = articleVersionDiff(version('标题\r\n旧段\r\n中间\r\n末尾'), version('标题\n新段\n中间\n加一行\n末尾'))
    expect(result.blocks).toEqual([
      { kind: 'same', lines: ['标题'] },
      { kind: 'removed', lines: ['旧段'] },
      { kind: 'added', lines: ['新段'] },
      { kind: 'same', lines: ['中间'] },
      { kind: 'added', lines: ['加一行'] },
      { kind: 'same', lines: ['末尾'] }
    ])
    expect(articleVersionDiff(version(null), version('')).changed).toBe(false)
    expect(articleVersionDiff(version(''), version('一行')).blocks).toEqual([{ kind: 'added', lines: ['一行'] }])
  })

  it('compares sanitized rich text structure without preserving executable markup', () => {
    const before = version('<p>\u4f60 &amp; 我</p><script>alert(1)</script>', 'RICHTEXT')
    const after = version('<h2 onclick="alert(2)">你 &amp; 我</h2>', 'RICHTEXT')
    const result = articleVersionDiff(before, after)
    expect(result.blocks).toEqual([
      { kind: 'removed', lines: ['<p>你 &amp; 我</p>'] },
      { kind: 'added', lines: ['<h2>你 &amp; 我</h2>'] }
    ])
  })

  it('preserves both documents in the bounded fallback for unrelated large sections', () => {
    const left = ['首行', ...Array.from({ length: 1200 }, (_, i) => `旧 ${i}`), '末行']
    const right = ['首行', ...Array.from({ length: 1200 }, (_, i) => `新 ${i}`), '末行']
    const result = articleVersionDiff(version(left.join('\n')), version(right.join('\n')))
    expect(result.coarse).toBe(true)
    expect(result.blocks.filter(block => block.kind !== 'added').flatMap(block => block.lines)).toEqual(left)
    expect(result.blocks.filter(block => block.kind !== 'removed').flatMap(block => block.lines)).toEqual(right)
  })
})
