import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const password = 'Browser-e2e-passw0rd!'
const headers = { 'X-Requested-With': 'XMLHttpRequest' }

test('owner reauthentication → freeze admin → old session denied → unfreeze; ordinary admin denied', async ({ page, browser }) => {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  const admin = await browser.newContext({ baseURL: 'http://127.0.0.1:25173' })
  const login = await admin.request.post('/api/auth/login', { headers, data: { username: fixture.accounts.admin, password } })
  expect((await login.json()).code).toBe('200')
  const forbidden = await admin.request.post(`/api/admin/owner/users/${fixture.accountIds.ADMIN}`, { headers, data: {} })
  expect(forbidden.status()).toBe(403)
  await page.goto('/login')
  await page.locator('#pane-login input').nth(0).fill(fixture.accounts.super_admin)
  await page.locator('#pane-login input').nth(1).fill(password)
  await page.locator('#pane-login').getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:25173/')
  // Remove only the short access credential: the real interceptor must rotate refresh.
  await page.context().clearCookies({ name: 'AUTH_TOKEN' })
  await page.goto('/admin/users')
  const row = page.locator('tr').filter({ hasText: fixture.accounts.admin })
  await row.getByRole('button', { name: '应急处置' }).click()
  let dialog = page.getByRole('dialog', { name: '管理员应急处置' })
  // Visibility alone misses fixed table cells painting above a nested overlay.
  // Check the panel and the background fixed cells before touching credentials.
  const panel = dialog.locator('.el-dialog')
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect(panel).toBeVisible()
    await expect.poll(() => panel.evaluate(element => {
      const r = element.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth &&
        r.top >= 0 && r.bottom <= window.innerHeight && element.contains(hit)
    })).toBe(true)
    await expect.poll(() => dialog.evaluate(element => {
      const cells = [...document.querySelectorAll('td.el-table-fixed-column--right')]
      return cells.length > 0 && cells.every(cell => {
        const r = cell.getBoundingClientRect()
        const x = r.left + r.width / 2, y = r.top + r.height / 2
        if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) return true
        return element.contains(document.elementFromPoint(x, y))
      })
    })).toBe(true)
    await dialog.locator('.el-select').click()
    await page.getByRole('option', { name: '修正邮箱', exact: true }).click()
    await expect(dialog.getByRole('textbox', { name: '新邮箱', exact: true })).toBeVisible()
    await page.screenshot({ path: `e2e-artifacts/owner-dialog-${viewport.width}.png` })
  }
  await dialog.getByRole('button', { name: 'Close this dialog' }).click()
  await expect(dialog).not.toBeVisible()
  await page.setViewportSize({ width: 1280, height: 900 })
  await row.getByRole('button', { name: '应急处置' }).click()
  await dialog.locator('.el-select').click()
  await page.getByRole('option', { name: '冻结账号', exact: true }).click()
  await dialog.locator('input[type=password]').fill('incorrect-password')
  await dialog.getByPlaceholder(fixture.accounts.admin, { exact: true }).fill(fixture.accounts.admin)
  let response = page.waitForResponse(r => r.url().endsWith(`/admin/owner/users/${fixture.accountIds.ADMIN}`) && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: '确认执行' }).click()
  expect((await (await response).json()).code).not.toBe('200')
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type=password]').fill(password)
  response = page.waitForResponse(r => r.url().endsWith(`/admin/owner/users/${fixture.accountIds.ADMIN}`) && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: '确认执行' }).click()
  expect((await (await response).json()).code).toBe('200')
  await expect(dialog).not.toBeVisible()
  await expect(row).toContainText('已封禁')
  expect((await admin.request.get('/api/auth/me')).status()).toBe(401)
  expect((await admin.request.post('/api/auth/refresh', { headers })).status()).toBe(401)
  await row.getByRole('button', { name: '应急处置' }).click()
  dialog = page.getByRole('dialog', { name: '管理员应急处置' })
  await dialog.locator('.el-select').click()
  await page.getByRole('option', { name: '解冻账号', exact: true }).click()
  await dialog.locator('input[type=password]').fill(password)
  await dialog.getByPlaceholder(fixture.accounts.admin, { exact: true }).fill(fixture.accounts.admin)
  await dialog.getByRole('button', { name: '确认执行' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(row).toContainText('正常')
  await admin.close()
})
