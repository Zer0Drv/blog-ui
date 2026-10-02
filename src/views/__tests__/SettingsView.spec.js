import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import SettingsView from '../SettingsView.vue'
import { useAuthStore } from '../../stores/auth'
import { updateMyProfile } from '../../api/user'
import { notifyProfileUpdated } from '../../utils/profileSync'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/settings', query: {} })
}))

vi.mock('../../api/user', () => ({
  updateMyProfile: vi.fn().mockResolvedValue({}),
  changeMyPassword: vi.fn(),
  getMyPreferences: vi.fn().mockResolvedValue({ emailNotifyEnabled: true }),
  updateMyPreferences: vi.fn()
}))

vi.mock('../../api/upload', () => ({
  uploadImage: vi.fn(),
  resolveUploadUrl: v => v
}))

vi.mock('../../utils/profileSync', () => ({
  notifyProfileUpdated: vi.fn(),
  onProfileUpdated: vi.fn(() => () => {})
}))

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'tester', nickname: '测试', avatar: '/uploads/old.png', bio: '' }
  auth.fetchMe = vi.fn().mockResolvedValue()
  const wrapper = mount(SettingsView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper, auth }
}

describe('SettingsView 保存资料', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('保存成功后调用 notifyProfileUpdated 通知各展示点刷新', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('保存资料'))
    await saveBtn.trigger('click')
    await flushPromises()

    expect(updateMyProfile).toHaveBeenCalledWith({ nickname: '测试', avatar: '/uploads/old.png', bio: '' })
    expect(notifyProfileUpdated).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('保存失败时不广播资料变更', async () => {
    updateMyProfile.mockRejectedValueOnce(new Error('network'))
    const { wrapper } = mountView()
    await flushPromises()

    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('保存资料'))
    await saveBtn.trigger('click')
    await flushPromises()

    expect(notifyProfileUpdated).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
