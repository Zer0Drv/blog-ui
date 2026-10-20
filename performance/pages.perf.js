import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import { observeMetrics, interactionSummary, assetSizes, median } from './metrics.mjs'

const origin = 'http://127.0.0.1:25173'
const title = 'Performance fixture: Markdown, formula and diagram'
const content = [
  '# Fixed performance fixture', '',
  '```javascript', 'const answer = 42', 'console.log(answer)', '```', '',
  '$$E = mc^2$$', '', '```mermaid', 'graph TD', '  A[Start] --> B[Finish]', '```', '',
  ...Array.from({ length: 20 }, (_, i) =>
    `## Section ${i + 1}\n\nA fixed paragraph for repeatable article rendering. Code, formulas and diagrams must remain readable.`)
].join('\n')

test('production home, article and editor: three cold samples', async ({ browser, request }) => {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  const versions = JSON.parse(await readFile('e2e-artifacts/versions.json', 'utf8'))
  expect(versions.frontendMode).toBe('production-preview')
  async function data(response) {
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.code).toBe('200')
    return body.data
  }
  await data(await request.post('/api/auth/login', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: { username: fixture.accounts.author, password: 'Browser-e2e-passw0rd!' }
  }))
  const articleId = await data(await request.post('/api/articles', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: { title, content, summary: 'Fixed performance sample', editorType: 'MARKDOWN', status: 'PUBLISHED', visibility: 'PUBLIC' }
  }))
  const article = await data(await request.get(`/api/articles/${articleId}`))
  const state = await request.storageState() // Memory only. Never write the session to artifacts.
  const samples = []
  const report = {
    schemaVersion: 1, versions,
    environment: { browser: browser.version(), node: process.version, platform: process.platform,
      cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
      viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1, cpuSlowdown: 4,
      network: { latencyMs: 40, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 93750 },
      cache: 'new context and disabled HTTP cache for each sample', samplesPerPage: 3 },
    fixture: { title, contentSha256: createHash('sha256').update(content).digest('hex'), contentBytes: Buffer.byteLength(content) },
    notes: [
      'Laboratory production preview, not deployed gateway or real-user Core Web Vitals.',
      'gzip level 9 and Brotli quality 11 are per-file estimates, not claimed wire compression.',
      'LCP/CLS cover navigation through the fixed observation window; labInteractionMaxMs is not field INP.',
      'Null interaction duration means no >=16ms Event Timing entry, not zero latency.',
      'Network entries cover navigation until snapshot; document HTML is excluded from resource entries.'
    ], samples
  }
  try {
    for (const name of ['home', 'article', 'editor']) {
      for (let iteration = 1; iteration <= 3; iteration++) {
        const context = await browser.newContext({
          viewport: report.environment.viewport, deviceScaleFactor: 1, locale: 'zh-CN', timezoneId: 'UTC',
          serviceWorkers: 'block', ...(name === 'editor' ? { storageState: state } : {})
        })
        try {
          const page = await context.newPage()
          const errors = []
          page.on('pageerror', error => errors.push(error.message))
          const cdp = await context.newCDPSession(page)
          await cdp.send('Network.enable')
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
          await cdp.send('Network.emulateNetworkConditionsByRule', {
            offline: false, matchedNetworkConditions: [{
              urlPattern: '*', latency: 40, downloadThroughput: 200000, uploadThroughput: 93750
            }]
          })
          await page.addInitScript(observeMetrics)
          const path = name === 'home' ? '/' : name === 'article' ? `/article/${article.slug || article.id}` : `/editor/${article.id}`
          await page.goto(origin + path, { waitUntil: 'load', timeout: 90000 })
          if (name === 'home') await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
          else if (name === 'article') {
            await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
            await expect(page.locator('.md-editor-preview .katex').first()).toBeVisible()
            await expect(page.locator('.md-editor-preview svg').first()).toBeVisible()
            await expect(page.locator('.md-editor-preview pre code').first()).toContainText('const answer')
          } else await expect(page.getByPlaceholder('请输入文章标题')).toHaveValue(title)
          // Fixed observation window, not networkidle (authenticated pages use WebSocket).
          await page.waitForTimeout(2000)
          const input = name === 'home' ? page.getByPlaceholder('搜索标题 / 摘要')
            : name === 'editor' ? page.getByPlaceholder('请输入文章标题') : page.getByRole('textbox', { name: '搜索文章' })
          await input.click()
          await input.press('End')
          await input.pressSequentially(' perf', { delay: 100 })
          await page.waitForTimeout(1000)
          const raw = await page.evaluate(() => window.__performanceSnapshot())
          expect(raw.lcpMs).toBeGreaterThan(0)
          expect(raw.fcpMs).toBeGreaterThan(0)
          expect(errors).toEqual([])
          const assets = await assetSizes(raw.resources)
          const { events, ...metrics } = raw
          const sample = { name, iteration, ...metrics, ...interactionSummary(events), assets,
            totals: Object.fromEntries(['js', 'css'].map(kind => [kind,
              Object.fromEntries(['raw', 'gzip', 'brotli'].map(size =>
                [size, assets.filter(asset => asset.kind === kind).reduce((sum, asset) => sum + asset[size], 0)]))])) }
          samples.push(sample)
          if (iteration === 1) await page.screenshot({ path: `e2e-artifacts/performance-${name}.png` })
        } finally { await context.close() }
      }
    }
    report.medians = Object.fromEntries(['home', 'article', 'editor'].map(name => {
      const group = samples.filter(sample => sample.name === name)
      return [name, Object.fromEntries(['lcpMs', 'fcpMs', 'cls', 'longTaskMs', 'labInteractionMaxMs'].map(key =>
        [key, median(group.map(sample => sample[key]))]))]
    }))
  } finally {
    report.complete = samples.length === 9
    await writeFile('e2e-artifacts/performance.json', JSON.stringify(report, null, 2) + '\n')
  }
})
