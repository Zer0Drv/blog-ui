import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const origin = 'http://127.0.0.1:25173'
const headers = { 'X-Requested-With': 'XMLHttpRequest' }
const titleInput = page => page.getByPlaceholder('请输入文章标题')
const markdown = page => page.locator('.md-editor .cm-content[contenteditable=true]')
async function data(response) {
  expect(response.ok()).toBeTruthy()
  const result = await response.json()
  expect(result.code, result.message).toBe('200')
  return result.data
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
async function create(page, title, options = {}) {
  return data(await page.request.post('/api/articles', { headers, data: {
    title, content: '# 生效内容\n\n原始生效正文', editorType: 'MARKDOWN', status: 'PUBLISHED', ...options
  } }))
}
async function editing(page, id) { return data(await page.request.get(`/api/articles/${id}/editing`)) }
async function saveWorking(page, id) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/articles/${id}` && r.request().method() === 'PUT')
  await page.getByRole('button', { name: '保存修改草稿', exact: true }).click()
  return data(await response)
}
async function publish(page, id) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/articles/${id}/publish` && r.request().method() === 'POST')
  await page.getByRole('button', { name: '更新发布', exact: true }).click()
  await page.getByRole('button', { name: '确认更新', exact: true }).click()
  return data(await response)
}
async function editAndWait(page, id, title, content) {
  await expect(titleInput(page)).toBeEnabled()
  await titleInput(page).fill(title)
  await markdown(page).fill(content)
  await expect.poll(async () => (await editing(page, id)).content, { timeout: 45000 }).toBe(content)
}

test('published edits survive refresh and a new login while readers keep the active version until explicit publish', async ({ page, browser }, info) => {
  const fixture = await login(page)
  const marker = fixture.runId.slice(0, 10)
  const originalTitle = `生效原稿 ${marker}`
  const changedTitle = `独立修改稿 ${marker}`
  const content = `# 独立修改稿\n\n尚未发布的修改 ${marker}`
  const id = await create(page, originalTitle)
  const original = await data(await page.request.get(`/api/articles/${id}`))
  const anonymous = await browser.newContext({ baseURL: origin })
  const relogged = await browser.newContext({ baseURL: origin })
  try {
    const reader = await anonymous.newPage()
    await reader.goto(`/article/${original.slug}`)
    await expect(reader.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible()
    await page.goto(`/editor/${id}`)
    await editAndWait(page, id, changedTitle, content)
    await saveWorking(page, id)
    const draft = await editing(page, id)
    expect(draft.hasWorkingCopy).toBe(true)
    expect(draft.activeTitle).toBe(originalTitle)
    expect((await data(await reader.request.get(`/api/articles/${id}`))).title).toBe(originalTitle)
    const denied = await (await reader.request.get(`/api/articles/${id}/editing`)).json()
    expect(denied.code).not.toBe('200')
    expect(JSON.stringify(denied)).not.toContain(changedTitle)

    await page.reload()
    await expect(titleInput(page)).toHaveValue(changedTitle)
    await expect(markdown(page)).toHaveText(content, { useInnerText: true })
    await expect(page.getByRole('dialog', { name: '恢复草稿' })).toHaveCount(0)
    const resumed = await relogged.newPage()
    await login(resumed)
    await resumed.goto(`/editor/${id}`)
    await expect(titleInput(resumed)).toHaveValue(changedTitle)
    await resumed.setViewportSize({ width: 390, height: 844 })
    await resumed.getByRole('button', { name: '预览修改', exact: true }).click()
    const preview = resumed.getByRole('dialog', { name: '修改草稿预览', exact: true })
    await expect(preview).toContainText(`尚未发布的修改 ${marker}`)
    const layout = await resumed.evaluate(() => ({
      width: document.documentElement.scrollWidth, viewport: innerWidth,
      overflow: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth)
        .slice(0, 8).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right }))
    }))
    expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport)
    await resumed.screenshot({ path: info.outputPath('working-draft-preview-mobile.png'), fullPage: true, animations: 'disabled' })
    await preview.locator('.el-dialog__headerbtn').click()
    await reader.reload()
    await expect(reader.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible()
    const committed = await publish(resumed, id)
    expect(committed.hasWorkingCopy).toBe(false)
    const active = await data(await reader.request.get(`/api/articles/${id}`))
    expect(active.title).toBe(changedTitle)
    expect(active.content).toBe(content)
    expect(active.publishTime).toBe(original.publishTime)
    await reader.reload()
    await expect(reader.getByRole('heading', { name: changedTitle, exact: true })).toBeVisible()
    await expect(reader.getByText(`尚未发布的修改 ${marker}`, { exact: true })).toBeVisible()
    await reader.screenshot({ path: info.outputPath('working-draft-published-desktop.png'), fullPage: true, animations: 'disabled' })
  } finally {
    await relogged.close()
    await anonymous.close()
  }
})

test('stale editor preserves local content, compares the server draft and reloads only after confirmation', async ({ page, context }, info) => {
  const fixture = await login(page)
  const id = await create(page, `冲突原稿 ${fixture.runId.slice(0, 10)}`)
  await page.goto(`/editor/${id}`)
  await expect(titleInput(page)).toBeEnabled()
  const other = await context.newPage()
  try {
    await other.goto(`/editor/${id}`)
    await expect(titleInput(other)).toBeEnabled()
    await editAndWait(page, id, '服务器较新修改稿', '# 服务器保存的正文')
    const rejected = other.waitForResponse(r => new URL(r.url()).pathname === `/api/articles/${id}/autosave` && r.request().method() === 'PUT', { timeout: 45000 })
    await titleInput(other).fill('本地冲突标题')
    await markdown(other).fill('# 本地冲突正文仍需保留')
    expect((await (await rejected).json()).code).toBe('40901')
    await expect(other.getByRole('alert').filter({ hasText: '本地修改已保留' })).toBeVisible()
    await expect(titleInput(other)).toHaveValue('本地冲突标题')
    await expect(markdown(other)).toHaveText('# 本地冲突正文仍需保留', { useInnerText: true })
    await other.getByRole('button', { name: '对比服务器版本', exact: true }).click()
    const comparison = other.getByRole('dialog', { name: '版本对比', exact: true })
    await expect(comparison.getByLabel('本地正文', { exact: true })).toHaveValue('# 本地冲突正文仍需保留')
    await expect(comparison.getByLabel('服务器正文', { exact: true })).toHaveValue('# 服务器保存的正文')
    await other.screenshot({ path: info.outputPath('working-draft-conflict-comparison.png'), fullPage: true, animations: 'disabled' })
    await comparison.locator('.el-dialog__headerbtn').click()
    await other.getByRole('button', { name: '重新加载最新稿', exact: true }).click()
    await other.getByRole('button', { name: '放弃本地修改', exact: true }).click()
    await expect(titleInput(other)).toHaveValue('服务器较新修改稿')
    await expect(markdown(other)).toHaveText('# 服务器保存的正文', { useInnerText: true })
    await expect(other.getByRole('alert').filter({ hasText: '本地修改已保留' })).toHaveCount(0)
  } finally { await other.close() }
})

test('discard and version restoration keep the active article unchanged until another explicit publish', async ({ page }, info) => {
  const fixture = await login(page)
  const firstTitle = `历史原稿 ${fixture.runId.slice(0, 10)}`
  const id = await create(page, firstTitle)
  const base = await editing(page, id)
  await data(await page.request.post(`/api/articles/${id}/publish`, { headers, data: {
    title: '当前发布稿', content: '# 当前发布正文', editorType: 'MARKDOWN', status: 'PUBLISHED', editRevision: base.editRevision
  } }))
  await page.goto(`/editor/${id}`)
  await editAndWait(page, id, '待放弃的修改', '# 不应成为发布稿')
  await page.getByRole('button', { name: '放弃修改', exact: true }).click()
  await page.getByRole('button', { name: '确认放弃', exact: true }).click()
  await expect(titleInput(page)).toHaveValue('当前发布稿')
  expect((await editing(page, id)).hasWorkingCopy).toBe(false)
  expect((await data(await page.request.get(`/api/articles/${id}`))).content).toBe('# 当前发布正文')
  await page.getByRole('button', { name: '历史版本', exact: true }).click()
  const history = page.getByRole('dialog', { name: '历史版本', exact: true })
  const version = history.getByRole('row').filter({ hasText: firstTitle })
  await version.getByRole('button', { name: '恢复', exact: true }).click()
  await page.getByRole('dialog', { name: '恢复版本', exact: true }).getByRole('button', { name: '恢复', exact: true }).click()
  await expect(titleInput(page)).toHaveValue(firstTitle)
  expect((await editing(page, id)).hasWorkingCopy).toBe(true)
  expect((await data(await page.request.get(`/api/articles/${id}`))).title).toBe('当前发布稿')
  await page.screenshot({ path: info.outputPath('restored-version-is-working-draft.png'), fullPage: true, animations: 'disabled' })
})

test('password, private and scheduled articles retain their audience and schedule throughout draft editing', async ({ page, browser }) => {
  const fixture = await login(page)
  const scheduledAt = new Date(Date.now() + 86400000).toISOString().slice(0, 19)
  const cases = [
    { name: '密码稿', visibility: 'PASSWORD', accessPassword: 'Draft-pass-93' },
    { name: '私密稿', visibility: 'PRIVATE' },
    { name: '定时稿', visibility: 'PUBLIC', publishTime: scheduledAt }
  ]
  const anonymous = await browser.newContext({ baseURL: origin })
  try {
    for (const entry of cases) {
      const { name, ...options } = entry
      const id = await create(page, `${name} ${fixture.runId.slice(0, 8)}`, options)
      const old = await data(await page.request.get(`/api/articles/${id}`))
      await page.goto(`/editor/${id}`)
      await expect(titleInput(page)).toBeEnabled()
      await titleInput(page).fill(`${name} 未发布修改`)
      await markdown(page).fill(`# ${name} 修改正文`)
      await saveWorking(page, id)
      expect((await data(await page.request.get(`/api/articles/${id}`))).title).toBe(old.title)
      const hiddenBefore = await (await anonymous.request.get(`/api/articles/${id}`)).json()
      expect(JSON.stringify(hiddenBefore)).not.toContain('修改正文')
      await publish(page, id)
      const active = await data(await page.request.get(`/api/articles/${id}`))
      expect(active.visibility).toBe(options.visibility)
      expect(active.publishTime).toBe(old.publishTime)
      expect(active.title).toBe(`${name} 未发布修改`)
      const hiddenAfter = await (await anonymous.request.get(`/api/articles/${id}`)).json()
      expect(JSON.stringify(hiddenAfter)).not.toContain('修改正文')
      if (options.visibility === 'PASSWORD') expect(hiddenAfter.data.passwordRequired).toBe(true)
      else expect(hiddenAfter.code).not.toBe('200')
    }
  } finally { await anonymous.close() }
})
