import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'

// Independent test-side implementation of the authenticator; production uses JCA on the server.
function otp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('')
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)))
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const hash = createHmac('sha1', key).update(counter).digest()
  return ((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1000000).toString().padStart(6, '0')
}

test('bind local QR → preserve recovery codes → password challenge → reject invalid code → recovery login → disable', async ({ page }) => {
  const fixture = JSON.parse(await readFile('e2e-artifacts/fixture.json', 'utf8'))
  const password = 'Browser-e2e-passw0rd!'
  async function primaryLogin() {
    await page.goto('/login')
    await page.locator('#pane-login input').nth(0).fill(fixture.accounts.user)
    await page.locator('#pane-login input').nth(1).fill(password)
    await page.locator('#pane-login').getByRole('button', { name: '登录', exact: true }).click()
  }
  await primaryLogin()
  await expect(page).toHaveURL('http://127.0.0.1:25173/')
  await page.goto('/settings')
  const settings = page.locator('.totp-settings')
  await settings.locator('input[type=password]').fill(password)
  await settings.getByRole('button', { name: '开始绑定' }).click()
  await expect(settings.locator('img')).toHaveAttribute('src', /^data:image\/png/)
  const secret = (await settings.locator('.secret').textContent()).trim()
  await settings.locator('input[autocomplete=one-time-code]').fill(otp(secret))
  await settings.getByRole('button', { name: '确认开启' }).click()
  await expect(settings.locator('.recovery-codes')).toBeVisible()
  const codes = (await settings.locator('.recovery-codes').textContent()).trim().split('\n')
  expect(codes).toHaveLength(10)
  await expect(settings.getByRole('button', { name: '重新登录', exact: true })).toBeDisabled()
  await settings.getByText('我已将恢复码保存到安全位置', { exact: true }).click()
  await expect(settings.getByRole('checkbox')).toBeChecked()
  await settings.getByRole('button', { name: '重新登录', exact: true }).click()
  await primaryLogin()
  await expect(page).toHaveURL(/\/login\/totp$/)
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  await page.getByRole('textbox').fill('invalid')
  await page.getByRole('button', { name: '验证并登录' }).click()
  await expect(page.getByText(/验证失败或已过期/)).toBeVisible()
  await expect(page).toHaveURL(/\/login\/totp$/)
  await page.getByRole('textbox').fill(codes[0])
  await page.getByRole('button', { name: '验证并登录' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:25173/')
  await page.goto('/settings')
  await expect(settings).toContainText('剩余 9 枚恢复码')
  await settings.locator('input[type=password]').fill(password)
  await settings.locator('input[autocomplete=one-time-code]').fill(codes[1])
  await settings.getByRole('button', { name: '关闭两步验证' }).click()
  await page.getByRole('dialog', { name: '安全设置' }).getByRole('button', { name: 'OK', exact: true }).click()
  await expect(settings).toContainText('所有设备需要重新登录')
})
