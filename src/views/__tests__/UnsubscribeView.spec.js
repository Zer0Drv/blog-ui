import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import UnsubscribeView from '../UnsubscribeView.vue'
import { unsubscribe } from '../../api/subscription'
const query = vi.hoisted(() => ({ token: 'a'.repeat(32) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query }) }))
vi.mock('../../api/subscription', () => ({ unsubscribe: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); query.token = 'a'.repeat(32) })
it('打开链接不自动退订，确认后再提交令牌', async () => {
  const wrapper = mount(UnsubscribeView, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(unsubscribe).not.toHaveBeenCalled()
  await wrapper.find('button').trigger('click')
  await flushPromises()
  expect(unsubscribe).toHaveBeenCalledWith('a'.repeat(32))
  expect(wrapper.text()).toContain('已取消站内与邮件订阅')
  wrapper.unmount()
})
it('非法令牌禁用退订请求', async () => {
  query.token = 'invalid'
  const wrapper = mount(UnsubscribeView, { global: { plugins: [ElementPlus] } })
  expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('退订链接无效')
  expect(unsubscribe).not.toHaveBeenCalled()
  wrapper.unmount()
})
