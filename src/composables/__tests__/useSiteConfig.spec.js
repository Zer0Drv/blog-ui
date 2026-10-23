import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../api/site', () => ({ getSiteConfig: vi.fn() }))
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); sessionStorage.clear() })

it('committed save wins over an older response', async () => {
  const { getSiteConfig } = await import('../../api/site')
  const config = await import('../useSiteConfig')
  let resolve
  getSiteConfig.mockReturnValue(new Promise(done => { resolve = done }))
  const pending = config.ensureSiteConfig()
  await Promise.resolve()
  config.publishSiteConfig({ 'site.friend_links_enabled': 'false' })
  resolve({ 'site.friend_links_enabled': 'true' })
  await pending
  expect(config.useSiteConfig().friendLinksEnabled.value).toBe(false)
  expect(JSON.parse(sessionStorage.getItem('site:config'))['site.friend_links_enabled']).toBe('false')
})

it('failed reads can be retried and stale session cache is never authoritative', async () => {
  sessionStorage.setItem('site:config', JSON.stringify({ 'site.friend_links_enabled': 'true' }))
  const { getSiteConfig } = await import('../../api/site')
  const config = await import('../useSiteConfig')
  getSiteConfig.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ 'site.friend_links_enabled': 'false' })
  expect(await config.ensureSiteConfig()).toBe(false)
  expect(await config.ensureSiteConfig()).toBe(true)
  expect(config.useSiteConfig().friendLinksEnabled.value).toBe(false)
})
