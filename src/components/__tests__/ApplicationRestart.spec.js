import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ApplicationRestart from '../ApplicationRestart.vue'
import http from '../../api/http'
import { getSysConfig } from '../../api/sysConfig'
vi.mock('../../api/http', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../api/sysConfig', () => ({ getSysConfig: vi.fn() }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ user: { role: 'SUPER_ADMIN' } }) }))
let wrapper
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })
afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })
it('does not offer an ineffective button when worker is unavailable', async () => {
  http.get.mockResolvedValue({ available: false, reason: '运维进程未连接' })
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.text()).toContain('运维进程未连接')
  expect(wrapper.find('button').exists()).toBe(false)
})
it('blocks restart with unsaved edits', async () => {
  http.get.mockResolvedValue({ available: true, instance: 'before' })
  wrapper = mount(ApplicationRestart, { props: { dirty: true }, global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.find('button').element.disabled).toBe(true)
  expect(http.post).not.toHaveBeenCalled()
})
it('recovery requires a different instance and matching active parameter values', async () => {
  vi.useFakeTimers()
  sessionStorage.setItem('application-restart', JSON.stringify({ id: 'test', instance: 'before', started: Date.now(), expected: [['setting', 5]] }))
  http.get.mockImplementation(url => Promise.resolve(url.endsWith('/test') ? { state: 'RECOVERED' } : { available: true, instance: 'after' }))
  getSysConfig.mockResolvedValue([{ key: 'setting', activeValue: 3, restartRequired: true }])
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.text()).toContain('参数生效验证未通过')
  expect(wrapper.text()).not.toContain('验证通过。')
})
