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

function savedJob(started = Date.now()) {
  vi.useFakeTimers()
  sessionStorage.setItem('application-restart', JSON.stringify({ id: 'test', instance: 'before', started, expected: [['setting', 5]] }))
}
it('network loss and the old instance are never treated as recovery', async () => {
  savedJob()
  http.get.mockImplementation(url => url.endsWith('/test') ? Promise.reject(new Error('offline')) : Promise.resolve({ available: true, instance: 'before' }))
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.emitted('recovered')).toBeUndefined()
  http.get.mockImplementation(url => Promise.resolve(url.endsWith('/test') ? { state: 'RECOVERED' } : { available: true, instance: 'before' }))
  await vi.advanceTimersByTimeAsync(3000)
  expect(getSysConfig).not.toHaveBeenCalled()
  expect(wrapper.emitted('recovered')).toBeUndefined()
})
it('a failed worker report stops polling and displays the failure', async () => {
  savedJob()
  http.get.mockImplementation(url => Promise.resolve(url.endsWith('/test') ? { state: 'FAILED', reason: '发布持锁，未重启' } : { available: true, instance: 'before' }))
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.text()).toContain('发布持锁，未重启')
  const calls = http.get.mock.calls.length
  await vi.advanceTimersByTimeAsync(30000)
  expect(http.get).toHaveBeenCalledTimes(calls)
  expect(wrapper.emitted('recovered')).toBeUndefined()
})
it('timeout remains inconclusive and does not submit another restart', async () => {
  savedJob(Date.now() - 241000)
  http.get.mockResolvedValue({ available: true, instance: 'after' })
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.text()).toContain('恢复验证超时')
  expect(http.post).not.toHaveBeenCalled()
  expect(wrapper.emitted('recovered')).toBeUndefined()
})
it('slow polling has one request in flight and cannot emit after unmount', async () => {
  savedJob()
  let resolve
  http.get.mockImplementation(url => url.endsWith('/test') ? new Promise(r => { resolve = r }) : Promise.resolve({ available: true, instance: 'before' }))
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await vi.advanceTimersByTimeAsync(9000)
  expect(http.get.mock.calls.filter(([url]) => url.endsWith('/test'))).toHaveLength(1)
  wrapper.unmount()
  resolve({ state: 'RECOVERED' })
  await flushPromises()
  expect(getSysConfig).not.toHaveBeenCalled()
  expect(wrapper.emitted('recovered')).toBeUndefined()
})

it('gateway failure after submission retains the job and verifies recovery without resubmitting', async () => {
  vi.useFakeTimers()
  http.get.mockResolvedValue({ available: true, instance: 'before' })
  http.post.mockRejectedValue(Object.assign(new Error('Bad Gateway'), { response: { status: 502 } }))
  wrapper = mount(ApplicationRestart, { global: { plugins: [ElementPlus], stubs: { ElDialog: { template: '<div><slot /></div>' } } } })
  await flushPromises()
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue('test-password')
  await inputs[2].setValue('RESTART_BACKEND')
  await wrapper.findAll('button').find(button => button.text() === '确认重启').trigger('click')
  await flushPromises()
  const job = JSON.parse(sessionStorage.getItem('application-restart'))
  expect(job.id).toBeTruthy()
  http.get.mockImplementation(url => Promise.resolve(url.endsWith(job.id) ? { state: 'RECOVERED' } : { available: true, instance: 'after' }))
  getSysConfig.mockResolvedValue([])
  await vi.advanceTimersByTimeAsync(3000)
  expect(http.post).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('待生效参数验证通过')
  expect(sessionStorage.getItem('application-restart')).toBeNull()
})
