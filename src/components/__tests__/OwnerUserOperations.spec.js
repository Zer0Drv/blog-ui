import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import OwnerUserOperations from '../OwnerUserOperations.vue'
import http from '../../api/http'
const mock = vi.hoisted(() => ({ role: 'SUPER_ADMIN' }))
vi.mock('../../api/http', () => ({ default: { post: vi.fn() } }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ user: { role: mock.role }, fetchMe: vi.fn() }) }))
beforeEach(() => { vi.clearAllMocks(); mock.role = 'SUPER_ADMIN' })
it('ordinary admins and peer super admins have no operation entry', () => {
  for (const [operator,target] of [['ADMIN','ADMIN'],['SUPER_ADMIN','SUPER_ADMIN']]) {
    mock.role = operator
    const wrapper = mount(OwnerUserOperations, { props: { user: { id: 2, role: target, username: 'target' } }, global: { plugins: [ElementPlus] } })
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  }
})
it('requires a password and exact target confirmation', async () => {
  const wrapper = mount(OwnerUserOperations, { props: { user: { id: 2, role: 'ADMIN', username: 'target' } }, global: { plugins: [ElementPlus], stubs: { ElDialog: { template: '<div><slot /></div>' } } } })
  await flushPromises()
  const submit = wrapper.findAll('button').find(b => b.text() === '确认执行')
  expect(submit.element.disabled).toBe(true)
  expect(http.post).not.toHaveBeenCalled()
  wrapper.unmount()
})
