import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const headers = { 'X-Requested-With': 'XMLHttpRequest' }
const origin = 'http://127.0.0.1:25173'
async function data(response) {
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.code, body.message).toBe('200')
  return body.data
}
async function login(page) {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  await page.goto('/login')
  await page.locator('#pane-login input').nth(0).fill(fixture.accounts.author)
  await page.locator('#pane-login input').nth(1).fill('Browser-e2e-passw0rd!')
  await page.locator('#pane-login').getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/`)
  return fixture
}
async function save(page, method = 'PUT') {
  const response = page.waitForResponse(r => r.url().includes('/api/series/manage') && r.request().method() === method)
  await page.getByRole('button', { name: '保存系列', exact: true }).click()
  return data(await response)
}

test('author creates and orders a series; public chapter counts and navigation track visibility on desktop and mobile', async ({ page, browser }, info) => {
  const fixture = await login(page)
  const marker = `series-${fixture.runId.slice(0, 12)}`
  const title = `系列验收 ${marker}`
  const articles = []
  for (const [name, status] of [['第一章', 'PUBLISHED'], ['待发布章节', 'DRAFT'], ['第二章', 'PUBLISHED'], ['第三章', 'PUBLISHED']]) {
    const articleTitle = `${name} ${marker}`
    const id = await data(await page.request.post('/api/articles', { headers, data: {
      title: articleTitle, content: `# ${articleTitle}\n\n系列浏览器验收正文`, editorType: 'MARKDOWN', status
    } }))
    articles.push({ id, title: articleTitle })
  }
  await page.goto('/my/series/new')
  await page.getByLabel('系列标题', { exact: true }).fill(title)
  await page.getByLabel('系列地址', { exact: true }).fill(marker)
  await page.getByLabel('系列简介', { exact: true }).fill('按顺序阅读的公开章节；尚未发布的章节不会进入目录。')
  await page.getByLabel('查找文章', { exact: true }).fill(marker)
  await page.getByRole('button', { name: '查找', exact: true }).click()
  for (const article of articles) await page.getByRole('button', { name: `添加《${article.title}》`, exact: true }).click()
  const created = await save(page, 'POST')
  await expect(page).toHaveURL(`${origin}/my/series/${created.id}`)
  await page.getByLabel('系列状态', { exact: true }).selectOption('PUBLISHED')
  await save(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.getByRole('heading', { name: '编辑系列', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('series-editor-mobile.png'), fullPage: true })
  const readerContext = await browser.newContext({ baseURL: origin })
  const reader = await readerContext.newPage()
  try {
    await reader.goto('/series')
    await reader.getByRole('link', { name: title, exact: true }).click()
    await expect(reader.locator('.chapter-list li')).toHaveCount(3)
    await expect(reader.locator('.chapter-list')).not.toContainText(articles[1].title)
    const published = await data(await reader.request.get(`/api/series/${marker}`))
    expect(published.articleCount).toBe(3)
    expect(published.articles.map(a => a.id)).toEqual([articles[0].id, articles[2].id, articles[3].id])

    await page.getByRole('button', { name: `上移《${articles[3].title}》`, exact: true }).click()
    await save(page)
    await reader.reload()
    await expect(reader.locator('.chapter-list li').nth(1)).toContainText(articles[3].title)
    await reader.screenshot({ path: info.outputPath('series-desktop.png'), fullPage: true })
    await reader.setViewportSize({ width: 390, height: 844 })
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await reader.screenshot({ path: info.outputPath('series-mobile.png'), fullPage: true })
    await reader.locator('.chapter-list').getByRole('link', { name: articles[0].title, exact: true }).click()
    const navigation = reader.getByRole('region', { name: '系列阅读导航', exact: true })
    await expect(navigation).toBeVisible()
    await expect(navigation).toContainText(articles[3].title)
    await expect(navigation).not.toContainText(articles[1].title)
    await reader.screenshot({ path: info.outputPath('series-article-navigation-mobile.png'), fullPage: true })

    await data(await page.request.put(`/api/articles/${articles[3].id}/status`, { headers, data: { status: 'OFFLINE' } }))
    await reader.reload()
    await expect(navigation).toContainText(articles[2].title)
    await expect(navigation).not.toContainText(articles[3].title)
    await reader.goto(`/series/${marker}`)
    await expect(reader.locator('.chapter-list li')).toHaveCount(2)

    await page.getByRole('button', { name: `移出《${articles[2].title}》`, exact: true }).click()
    await save(page)
    await reader.reload()
    await expect(reader.locator('.chapter-list li')).toHaveCount(1)
    await page.getByLabel('系列状态', { exact: true }).selectOption('DRAFT')
    await save(page)
    await reader.reload()
    await expect(reader.locator('.chapter-list')).toHaveCount(0)
    expect(await data(await reader.request.get(`/api/series/by-article/${articles[0].id}`))).toEqual([])
  } finally {
    await readerContext.close()
  }
})

test('stale series editor preserves local content after a concurrent save and empty public series remains readable', async ({ page, context }) => {
  const fixture = await login(page)
  const slug = `empty-${fixture.runId.slice(0, 12)}`
  const initial = await data(await page.request.post('/api/series/manage', { headers, data: {
    title: '空系列验收', slug, description: '', cover: '', status: 'PUBLISHED', articleIds: []
  } }))
  await page.goto(`/my/series/${initial.id}`)
  const other = await context.newPage()
  try {
    await other.goto(`/my/series/${initial.id}`)
    await expect(other.getByLabel('系列标题', { exact: true })).toHaveValue('空系列验收')
    await other.getByLabel('系列标题', { exact: true }).fill('本地未保存内容')
    await page.getByLabel('系列标题', { exact: true }).fill('已发布的新名称')
    await save(page)
    const response = other.waitForResponse(r => r.url().includes(`/api/series/manage/${initial.id}`) && r.request().method() === 'PUT')
    await other.getByRole('button', { name: '保存系列', exact: true }).click()
    expect((await (await response).json()).code).toBe('40900')
    await expect(other.getByLabel('系列标题', { exact: true })).toHaveValue('本地未保存内容')
    await expect(other.getByRole('button', { name: '重新加载系列', exact: true })).toBeVisible()
    await expect(other.getByRole('alert').filter({ hasText: /修改|冲突|版本/ }).first()).toBeVisible()
    const actual = await data(await page.request.get(`/api/series/${slug}`))
    expect(actual.title).toBe('已发布的新名称')
    expect(actual.articleCount).toBe(0)
    expect(actual.articles).toEqual([])
    await page.goto(`/series/${slug}`)
    await expect(page.getByRole('heading', { name: '已发布的新名称', exact: true })).toBeVisible()
    await expect(page.locator('.chapter-list li')).toHaveCount(0)
  } finally {
    await other.close()
  }
})
