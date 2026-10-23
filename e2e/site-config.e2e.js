import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const headers = { 'X-Requested-With': 'XMLHttpRequest' }
async function data(response) {
  expect(response.ok()).toBeTruthy()
  const result = await response.json()
  expect(result.code).toBe('200')
  return result.data
}

test('friend links switch commits on save and updates another tab, reload and direct URL', async ({ page, context }) => {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  await data(await page.request.post('/api/auth/login', { headers, data: { username: fixture.accounts.admin, password: 'Browser-e2e-passw0rd!' } }))
  const original = await data(await page.request.get('/api/admin/site/config'))
  let linkId
  const reader = await context.newPage()
  try {
    linkId = await data(await page.request.post('/api/admin/friend-links', { headers, data: { name: 'Acceptance link', url: 'https://example.com/', description: 'Isolated fixture', sort: 0, status: 1 } }))
    await data(await page.request.put('/api/admin/site/config', { headers, data: { ...original, 'site.friend_links_enabled': 'true' } }))
    await reader.goto('/links')
    await expect(reader.getByRole('link', { name: /Acceptance link/ })).toBeVisible()
    await page.goto('/admin/site')
    const toggle = page.locator('.el-form-item').filter({ hasText: '点击保存后生效' }).locator('.el-switch')
    await expect(toggle.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    // Local edits must not publish the uncommitted switch.
    expect((await data(await page.request.get('/api/site/config')))['site.friend_links_enabled']).toBe('true')
    await expect(reader.getByRole('link', { name: /Acceptance link/ })).toBeVisible()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(reader.getByText('本站暂未开放友情链接')).toBeVisible()
    await expect(reader.getByRole('link', { name: /Acceptance link/ })).toHaveCount(0)
    expect(await data(await page.request.get('/api/friend-links'))).toEqual([])
    await reader.reload()
    await expect(reader.getByText('本站暂未开放友情链接')).toBeVisible()
    await page.goto('/links')
    await expect(page.getByText('本站暂未开放友情链接')).toBeVisible()
    await page.goto('/admin/site')
    await toggle.click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(reader.getByRole('link', { name: /Acceptance link/ })).toBeVisible()
    await reader.reload()
    await expect(reader.getByRole('link', { name: /Acceptance link/ })).toBeVisible()
  } finally {
    await data(await page.request.put('/api/admin/site/config', { headers, data: original }))
    if (linkId) await data(await page.request.delete(`/api/admin/friend-links/${linkId}`, { headers }))
    await reader.close()
  }
})
