import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assetSizes, interactionSummary, median } from '../performance/metrics.mjs'

describe('performance evidence', () => {
  it('counts an interaction once even when keydown and keyup both report it', () => {
    expect(interactionSummary([{ id: 7, duration: 24 }, { id: 7, duration: 40 }, { id: 14, duration: 16 }]))
      .toEqual({ observedInteractions: 2, labInteractionMaxMs: 40 })
    expect(interactionSummary([])).toEqual({ observedInteractions: 0, labInteractionMaxMs: null })
  })
  it('does not turn missing samples into zero-duration measurements', () => {
    expect(median([null, 40, 24])).toBe(32)
    expect(median([null])).toBeNull()
    expect(median([10, 100, 20])).toBe(20)
  })
  it('counts each fetched local JS/CSS file once and rejects paths outside dist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'blog-performance-'))
    try {
      await writeFile(join(dir, 'app.js'), 'const sample = 1;\n'.repeat(100))
      const result = await assetSizes([
        { path: '/app.js', sameOrigin: true }, { path: '/app.js', sameOrigin: true },
        { path: '/remote.js', sameOrigin: false }, { path: '/api/articles', sameOrigin: true }
      ], dir)
      expect(result).toHaveLength(1)
      expect(result[0].raw).toBe(1800)
      expect(result[0].gzip).toBeLessThan(result[0].raw)
      expect(result[0].brotli).toBeLessThan(result[0].raw)
      await writeFile(join(dir, 'app.js'), 'changed')
      expect((await assetSizes([{ path: '/app.js', sameOrigin: true }], dir))[0].raw).toBe(7)
      await expect(assetSizes([{ path: '/../escape.js', sameOrigin: true }], dir)).rejects.toThrow('outside dist')
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
