import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import TotpLoginView from '../TotpLoginView.vue'
const mock = vi.hoisted(() => ({ replace: vi.fn(), completeMfa: vi.fn(), cancelMfa: vi.fn(), mfaChallenge: null, query: {} }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mock.query }), useRouter: () => ({ replace: mock.replace }) }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => mock }))
const mountView = () => mount(TotpLoginView, { global: { plugins: [ElementPlus] } })
describe('两步登录页', () => {
  beforeEach(() => { vi.resetAllMocks(); mock.mfaChallenge = 'challenge'; mock.query = {} })
  it('刷新丢失挑战后返回登录页', async () => {
    mock.mfaChallenge = null
    const w = mountView(); await flushPromises()
    expect(mock.replace).toHaveBeenCalledWith('/login'); w.unmount()
  })
  it('验证失败不跳转，成功才恢复目标页面', async () => {
    mock.query = { redirect: '/settings' }
    mock.completeMfa.mockRejectedValueOnce(new Error('invalid')).mockResolvedValueOnce(undefined)
    const w = mountView(); await flushPromises()
    await w.find('input').setValue('123456'); await w.find('form').trigger('submit'); await flushPromises()
    expect(mock.replace).not.toHaveBeenCalled()
    expect(w.find('input').element.value).toBe('')
    await w.find('input').setValue('654321'); await w.find('form').trigger('submit'); await flushPromises()
    expect(mock.completeMfa).toHaveBeenLastCalledWith('654321')
    expect(mock.replace).toHaveBeenCalledWith('/settings'); w.unmount()
    expect(mock.cancelMfa).toHaveBeenCalled()
  })
})
