import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import MainLayout from '../MainLayout.vue'
import { useAuthStore } from '../../stores/auth'
import { notifyProfileUpdated } from '../../utils/profileSync'

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

  it('导航栏用户入口渲染头像（src 为 resolveUploadUrl 补 /api 前缀后的地址）', async () => {
    const { wrapper, auth } = mountLayout()
    auth.user = { username: 'tester', nickname: '测试', role: 'USER', avatar: '/uploads/202501/a.png' }
    await flushPromises()
    const img = wrapper.find('.user-entry .el-avatar img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/api/uploads/202501/a.png')
    wrapper.unmount()
  })

  it('auth.user.avatar 更新后导航栏头像 src 响应式变化', async () => {
    const { wrapper, auth } = mountLayout()
    auth.user = { username: 'tester', nickname: '测试', role: 'USER', avatar: '/uploads/old.png' }
    await flushPromises()
    expect(wrapper.find('.user-entry .el-avatar img').attributes('src')).toBe('/api/uploads/old.png')

    auth.user = { ...auth.user, avatar: '/uploads/new.png' }
    await flushPromises()
    expect(wrapper.find('.user-entry .el-avatar img').attributes('src')).toBe('/api/uploads/new.png')
    wrapper.unmount()
  })

  it('收到资料变更事件后重新 fetchMe 刷新全局用户状态', async () => {
    const { wrapper, auth } = mountLayout()
    auth.fetchMe = vi.fn().mockResolvedValue()
    await flushPromises()
    expect(auth.fetchMe).not.toHaveBeenCalled()
    notifyProfileUpdated()
    expect(auth.fetchMe).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
