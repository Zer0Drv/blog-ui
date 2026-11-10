import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const headers = { 'X-Requested-With': 'XMLHttpRequest' }

async function data(response) {
  expect(response.ok()).toBeTruthy()
  const result = await response.json()
  expect(result.code, result.message).toBe('200')
  return result.data
}

test('reading preferences persist and position restoration is explicit and limited to public articles', async ({ page }, info) => {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  await data(await page.request.post('/api/auth/login', { headers, data: {
    username: fixture.accounts.author, password: 'Browser-e2e-passw0rd!'
  } }))
  const marker = fixture.runId.slice(0, 12)
  const paragraphs = Array.from({ length: 45 }, (_, i) => `<h2>第 ${i + 1} 节</h2><p>这里是用于阅读进度验证的公开正文。</p>`).join('')
  const create = options => page.request.post('/api/articles', { headers, data: {
    status: 'PUBLISHED', ...options
  } }).then(data)
  const rich = await create({
    title: '阅读偏好测试', slug: `reading-rich-${marker}`, editorType: 'RICHTEXT',
    content: paragraphs + '<pre><code>hello &lt;world&gt;</code></pre>'
  })
  const markdown = await create({
    title: 'Markdown 阅读测试', slug: `reading-md-${marker}`, editorType: 'MARKDOWN',
    content: '## 示例\n\n```js\nconsole.log(42)\n```\n\n$x^2$\n\n```mermaid\nflowchart LR\nA --> B\n```'
  })
  const privateArticle = await create({
    title: '私密标题', slug: `reading-private-${marker}`, editorType: 'RICHTEXT', visibility: 'PRIVATE',
    content: paragraphs
  })
  const url = slug => `/article/${slug}`
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto(url(`reading-rich-${marker}`))
  await expect(page.getByText(/预计阅读/)).toBeVisible()
  await page.getByText('阅读设置', { exact: true }).press('Enter')
  await page.getByLabel('主题', { exact: true }).selectOption('dark')
  await page.getByLabel('字号', { exact: true }).selectOption('large')
  await page.getByLabel('行距', { exact: true }).selectOption('relaxed')
  await expect(page.locator('.reading-card')).toHaveClass(/reading-dark/)
  await expect(page.locator('.richtext')).toHaveCSS('font-size', '19.2px')
  await page.mouse.wheel(0, 1350)
  const positions = () => page.evaluate(() => JSON.parse(localStorage.getItem('blog.reading.positions') || '{}'))
  await expect.poll(async () => (await positions())[String(rich)]?.fraction).toBeGreaterThan(0.05)

  await page.goto(url(`reading-rich-${marker}`) + '#toc-8')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.goto(url(`reading-md-${marker}`))
  await expect(page.locator('.md-editor-preview pre').filter({ hasText: 'console.log(42)' }).first()).toBeVisible()
  await expect(page.locator('.reading-body .katex').first()).toBeVisible()
  await expect(page.locator('.reading-body svg').last()).toBeVisible()
  await expect(page.locator('.reading-card')).toHaveClass(/reading-dark/)
  expect((await positions())[String(markdown)]).toBeUndefined()
  await page.screenshot({ path: info.outputPath('reading-dark-markdown-mobile.png'), fullPage: true })

  await page.goto(url(`reading-rich-${marker}`))
  const resume = page.getByRole('button', { name: '继续上次阅读' })
  await expect(resume).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(30)
  await resume.press('Enter')
  await expect(resume).toHaveCount(0)
  await expect(page.locator('.reading-body')).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  await page.goto(`/article/${privateArticle}`)
  await expect(page.getByRole('heading', { name: '私密标题' })).toBeVisible()
  await page.mouse.wheel(0, 1250)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  expect((await positions())[String(privateArticle)]).toBeUndefined()
  expect(JSON.stringify(await positions())).not.toContain('私密标题')
})
