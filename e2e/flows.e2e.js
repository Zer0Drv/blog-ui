import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const password = 'Browser-e2e-passw0rd!'
const fixture = async () => JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))

async function login(page, role = 'author') {
  const data = await fixture()
  await page.goto('/login')
  await page.locator('#pane-login input').nth(0).fill(data.accounts[role])
  await page.locator('#pane-login input').nth(1).fill(password)
  await page.locator('#pane-login').getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:25173/')
  return data
}

const titleInput = page => page.getByPlaceholder('请输入文章标题')
const markdown = page => page.locator('.md-editor .cm-content[contenteditable=true]')
async function responseData(response) {
  expect(response.ok()).toBeTruthy()
  const result = await response.json()
  expect(result.code).toBe('200')
  return result.data
}

test('login → edit → real Redis autosave → refresh recovery → publish → anonymous reading and search', async ({ page, browser }, info) => {
  const data = await login(page)
  const id = data.articles['draft-a']
  const title = `Browser published ${data.runId}`
  const content = `# Browser E2E\n\nAutosaved content ${data.runId}`
  await page.goto(`/editor/${id}`)
  await expect(titleInput(page)).toBeEnabled()
  await titleInput(page).fill(title)
  await markdown(page).fill(content)
  await expect(page.getByText(/已自动保存/)).toBeVisible({ timeout: 45000 })
  const draft = await responseData(await page.request.get(`/api/articles/${id}/autosave`))
  expect(draft.content).toBe(content)
  expect(draft.title).toBe(title)
  await page.reload()
  await expect(page.getByRole('dialog', { name: '恢复草稿' })).toBeVisible()
  await page.getByRole('button', { name: '恢复', exact: true }).click()
  await expect(titleInput(page)).toHaveValue(title)
  await expect(markdown(page)).toHaveText(content, { useInnerText: true })
  await page.getByRole('button', { name: '发布', exact: true }).click()
  await page.getByRole('button', { name: '确认发布', exact: true }).click()
  await expect(page.getByText('发布成功', { exact: true })).toBeVisible()
  const article = await responseData(await page.request.get(`/api/articles/${id}`))
  expect(article.content).toBe(content)
  expect(article.status).toBe('PUBLISHED')
  const anonymous = await browser.newContext()
  const reader = await anonymous.newPage()
  await reader.goto(`http://127.0.0.1:25173/article/${article.slug}`)
  await expect(reader.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(reader.getByText(`Autosaved content ${data.runId}`, { exact: true })).toBeVisible()
  await reader.goto(`http://127.0.0.1:25173/search?keyword=${encodeURIComponent(data.runId)}`)
  await expect(reader.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await reader.screenshot({ path: info.outputPath('published-search.png'), fullPage: true })
  await anonymous.close()
})

test('import from an edited draft → switch to imported article → save without overwriting original draft', async ({ page }, info) => {
  const data = await login(page)
  const originalId = data.articles['draft-b']
  const originalTitle = `Original draft ${data.runId}`
  const originalContent = `# Original unsaved ${data.runId}`
  const importedTitle = `Imported ${data.runId}`
  await page.goto(`/editor/${originalId}`)
  await expect(titleInput(page)).toBeEnabled()
  await titleInput(page).fill(originalTitle)
  await markdown(page).fill(originalContent)
  await page.locator('input[type=file][accept*=".md"]').setInputFiles({
    name: 'browser-import.md', mimeType: 'text/markdown',
    buffer: Buffer.from(`---\ntitle: ${importedTitle}\n---\n# Imported body ${data.runId}`)
  })
  await expect(titleInput(page)).toHaveValue(importedTitle)
  const importedId = new URL(page.url()).pathname.split('/').at(-1)
  expect(importedId).not.toBe(String(originalId))
  const draft = await responseData(await page.request.get(`/api/articles/${originalId}/autosave`))
  expect(draft.content).toBe(originalContent)
  expect(draft.title).toBe(originalTitle)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible()
  const imported = await responseData(await page.request.get(`/api/articles/${importedId}`))
  expect(imported.title).toBe(importedTitle)
  expect(imported.content).toContain(`Imported body ${data.runId}`)
  const original = await responseData(await page.request.get(`/api/articles/${originalId}`))
  expect(original.title).not.toBe(importedTitle)
  await page.screenshot({ path: info.outputPath('imported-draft.png'), fullPage: true })
})

test('real multipart attachment upload → MinIO bytes → browser image', async ({ page }, info) => {
  await login(page)
  await page.goto('/my/attachments')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', 'base64')
  const upload = page.waitForResponse(response => response.url().includes('/api/upload') && response.request().method() === 'POST')
  await page.locator('input[type=file]').setInputFiles({ name: 'browser-e2e.png', mimeType: 'image/png', buffer: png })
  const result = await responseData(await upload)
  const bytes = await page.request.get(result.url)
  expect(bytes.ok()).toBeTruthy()
  expect(await bytes.body()).toEqual(png)
  await expect(page.getByText('browser-e2e.png', { exact: true })).toBeVisible()
  await expect.poll(async () => page.locator('.grid-img img').evaluateAll(images => images.some(image => image.complete && image.naturalWidth > 0))).toBe(true)
  await page.screenshot({ path: info.outputPath('attachment-upload.png'), fullPage: true })
})

test('incorrect login, anonymous guard and reader write denial use real security chain', async ({ page }, info) => {
  const data = await fixture()
  await page.goto('/editor/new')
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/login')
  await page.locator('#pane-login input').nth(0).fill(data.accounts.user)
  await page.locator('#pane-login input').nth(1).fill('incorrect-password')
  await page.locator('#pane-login').getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('用户名或密码错误', { exact: true })).toBeVisible()
  await login(page, 'user')
  const denied = await page.request.post('/api/articles', { headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: { title: 'reader must not publish', content: '# denied', editorType: 'MARKDOWN', status: 'DRAFT' } })
  expect((await denied.json()).code).toBe('40300')
  await page.goto('/editor/new')
  await expect(page.getByPlaceholder('请输入文章标题')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('reader-permission-denied.png'), fullPage: true })
})

test('offline autosave prevents route departure and preserves the draft until connectivity returns', async ({ page }, info) => {
  const data = await login(page)
  const id = data.articles['draft-failure']
  const content = `# Offline protected content ${data.runId}`
  await page.goto(`/editor/${id}`)
  await expect(titleInput(page)).toBeEnabled()
  await markdown(page).fill(content)
  await page.context().setOffline(true)
  await page.getByRole('link', { name: '首页', exact: true }).click()
  await page.getByRole('button', { name: '继续编辑', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/editor/${id}$`))
  await expect(markdown(page)).toHaveText(content, { useInnerText: true })
  await page.context().setOffline(false)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible()
  const article = await responseData(await page.request.get(`/api/articles/${id}`))
  expect(article.content).toBe(content)
  await page.screenshot({ path: info.outputPath('offline-recovered-draft.png'), fullPage: true })
})
