import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import MainLayout from '../MainLayout.vue'
import { useAuthStore } from '../../stores/auth'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/', query: {} })
}))

vi.mock('../../api/notification', () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ count: 0 })
}))

vi.mock('../../api/site', () => ({
  getSiteConfig: vi.fn().mockResolvedValue({})
}))

function mountLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  // Cookie 会话（#13）：登录态由 user 判定
  auth.user = { username: 'tester', nickname: '测试', role: 'USER' }
  const wrapper = mount(MainLayout, {
    global: {
      plugins: [pinia, ElementPlus],
      stubs: { RouterLink: RouterLinkStub, RouterView: true }
    },
    attachTo: document.body
  })
  return { wrapper, auth }
}

describe('MainLayout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('用户下拉菜单包含「个人设置」项（command=settings）', async () => {
    const { wrapper } = mountLayout()
    await flushPromises()
    await wrapper.find('.user-entry').trigger('click')
    await flushPromises()
    const items = Array.from(document.body.querySelectorAll('.el-dropdown-menu__item'))
      .map(el => el.textContent.trim())
    expect(items).toContain('个人设置')
    wrapper.unmount()
  })
})
