import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const headers = { 'X-Requested-With': 'XMLHttpRequest' }
async function data(response) {
  expect(response.ok()).toBeTruthy()
  const result = await response.json()
  expect(result.code, result.message).toBe('200')
  return result.data
}

test('search combines filters, preserves pagination history and safely highlights body matches on desktop and mobile', async ({ page, browser }, info) => {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  await data(await page.request.post('/api/auth/login', { headers,
    data: { username: fixture.accounts.admin, password: 'Browser-e2e-passw0rd!' } }))
  const marker = `search${fixture.runId.slice(0, 10)}`
  const categoryId = await data(await page.request.post('/api/categories', { headers, data: { name: marker } }))
  const tagId = await data(await page.request.post('/api/tags', { headers, data: { name: marker } }))
  // Each create commits before the public FULLTEXT query, including its index update.
  for (let i = 0; i < 12; i++) {
    await data(await page.request.post('/api/articles', { headers, data: {
      title: `${marker} article ${i}`, content: `${'Opening text. '.repeat(30)}Body match ${marker} <script>window.searchInjected=true</script>`,
      editorType: 'MARKDOWN', status: 'PUBLISHED', categoryId, tagIds: [tagId], summary: 'Summary without the body match'
    } }))
  }
  await data(await page.request.post('/api/articles', { headers, data: {
    title: `${marker} secret draft`, content: marker, editorType: 'MARKDOWN', status: 'DRAFT', categoryId, tagIds: [tagId]
  } }))
  await data(await page.request.post('/api/articles', { headers, data: {
    title: '优惠说明', content: '正文只说明活动规则', summary: '折扣 50% 限时优惠',
    editorType: 'MARKDOWN', status: 'PUBLISHED', categoryId, tagIds: [tagId]
  } }))
  await data(await page.request.post('/api/articles', { headers, data: {
    title: '中文分词样本', content: `${'前言'.repeat(180)}搜索${'后续'.repeat(80)}`,
    editorType: 'MARKDOWN', status: 'PUBLISHED', categoryId, tagIds: [tagId]
  } }))
  const readerContext = await browser.newContext()
  const reader = await readerContext.newPage()
  try {
    const today = new Date().toISOString().slice(0, 10)
    const query = new URLSearchParams({ keyword: marker, categoryId: String(categoryId), tagId: String(tagId), sort: 'newest', publishedTo: today })
    await reader.goto(`http://127.0.0.1:25173/search?${query}`)
    await expect(reader.locator('.article-card')).toHaveCount(10)
    await expect(reader.locator('.result-tip')).toContainText('12')
    await expect(reader.getByText(`${marker} secret draft`)).toHaveCount(0)
    await expect(reader.locator('.summary mark').filter({ hasText: marker }).first()).toHaveText(marker)
    await expect(reader.locator('.article-card script')).toHaveCount(0)
    expect(await reader.evaluate(() => window.searchInjected)).toBeUndefined()
    await expect(reader.getByLabel('分类', { exact: true })).toHaveValue(String(categoryId))
    await expect(reader.getByLabel('标签', { exact: true })).toHaveValue(String(tagId))
    await expect(reader.getByLabel('发布结束日期')).toHaveValue(today)
    await reader.getByLabel('排序', { exact: true }).selectOption('oldest')
    await reader.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(reader).toHaveURL(/sort=oldest/)
    await expect(reader.locator('.article-card .title').first()).toContainText('article 0')
    await reader.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(reader).toHaveURL(/page=2/)
    await expect(reader.locator('.article-card')).toHaveCount(2)
    await reader.reload()
    await expect(reader.locator('.article-card')).toHaveCount(2)
    await reader.goBack()
    await expect(reader.locator('.article-card')).toHaveCount(10)
    await reader.goForward()
    await expect(reader.locator('.article-card')).toHaveCount(2)
    await reader.screenshot({ path: info.outputPath('search-desktop.png'), fullPage: true })
    await reader.setViewportSize({ width: 390, height: 844 })
    await expect(reader.locator('.article-card').first()).toBeVisible()
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await reader.screenshot({ path: info.outputPath('search-mobile.png'), fullPage: true })
    await reader.getByLabel('关键词', { exact: true }).fill('%')
    await reader.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(reader.locator('.article-card')).toHaveCount(1)
    await expect(reader.locator('.summary mark')).toHaveText('%')
    await expect(reader.locator('.sort-notice')).toContainText('字面包含匹配')
    await reader.getByLabel('关键词', { exact: true }).fill('搜索功能')
    await reader.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(reader.locator('.article-card')).toHaveCount(1)
    await expect(reader.locator('.summary mark')).toHaveText('搜索')
    await reader.getByLabel('关键词', { exact: true }).fill(`not-present-${fixture.runId}`)
    await reader.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(reader.locator('.article-card')).toHaveCount(0)
    await reader.getByRole('button', { name: '清空条件', exact: true }).first().click()
    await expect(reader).toHaveURL('http://127.0.0.1:25173/search')
    await expect(reader.locator('.article-card')).toHaveCount(10)
  } finally {
    await readerContext.close()
  }
})
