import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import SessionDevices from '../SessionDevices.vue'
import http from '../../api/http'

vi.mock('../../api/http', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const current = { id: 'current', label: 'Firefox · Windows', current: true, signedInAt: 1750000000 }
const other = { id: 'other', label: 'Safari · iOS', current: false, signedInAt: 1750000000 }
const button = (wrapper, text) => wrapper.findAll('button').find(node => node.text() === text)
let card

async function mountDevices() {
  card = mount(SessionDevices, { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
  return card
}

describe('登录设备', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    http.get.mockImplementation(async url => url === '/auth/totp' ? { enabled: true } : [current, other])
  })

  afterEach(() => card?.unmount())

  it('只允许退出其他设备，提交验证后更新列表', async () => {
    const wrapper = await mountDevices()
    expect(wrapper.text()).toContain('当前设备')
    expect(wrapper.findAll('li').at(0).find('button').exists()).toBe(false)
    await button(wrapper, '退出此设备').trigger('click')
    await flushPromises()
    const dialog = new DOMWrapper(document.querySelector('[role="dialog"]'))
    await dialog.get('input[type="password"]').setValue('test-password')
    expect(button(dialog, '确认退出').attributes('disabled')).toBeDefined()
    await dialog.get('[autocomplete="one-time-code"]').setValue('123456')
    http.post.mockResolvedValueOnce({ count: 1 })
    http.get.mockResolvedValueOnce([current])
    await dialog.get('form').trigger('submit')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('/auth/sessions/other/revoke', {
      password: 'test-password', code: '123456'
    }, { silent: true })
    expect(wrapper.text()).toContain('已退出 1 台设备')
    expect(wrapper.text()).not.toContain('Safari')
  })

  it('读取失败可重试，空列表有说明', async () => {
    http.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    const wrapper = await mountDevices()
    expect(wrapper.text()).toContain('无法读取登录设备')
    await button(wrapper, '重试').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('暂无可管理的登录设备')
  })

  it('批量退出失败时保留列表、显示原因并清理密码', async () => {
    http.get.mockImplementation(async url => url === '/auth/totp' ? { enabled: false } : [current, other])
    http.post.mockRejectedValueOnce(new Error('验证失败'))
    const wrapper = await mountDevices()
    await button(wrapper, '退出所有其他设备').trigger('click')
    await flushPromises()
    const dialog = new DOMWrapper(document.querySelector('[role="dialog"]'))
    const password = dialog.get('input[type="password"]')
    await password.setValue('wrong')
    await dialog.get('form').trigger('submit')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('/auth/sessions/others/revoke', { password: 'wrong', code: null }, { silent: true })
    expect(dialog.get('[role="alert"]').text()).toBe('验证失败')
    expect(password.element.value).toBe('')
    expect(wrapper.text()).toContain('Safari')
  })
})
