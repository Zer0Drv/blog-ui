import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import LoginView from '../LoginView.vue'
import { useAuthStore } from '../../stores/auth'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))

// jsdom 不允许真实跳转，替换 location 以断言 GitHub 授权 URL
const locationMock = { href: '' }
Object.defineProperty(window, 'location', {
  configurable: true,
  writable: true,
  value: locationMock
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(LoginView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  const auth = useAuthStore()
  return { wrapper, auth }
}

describe('LoginView', () => {
  beforeEach(() => {
    locationMock.href = ''
    document.body.innerHTML = ''
  })

  it('冒烟：渲染登录/注册 tab 与 GitHub 登录按钮', () => {
    const { wrapper } = mountView()
    const tabs = wrapper.findAll('.el-tabs__item').map(t => t.text())

    expect(tabs).toContain('登录')
    expect(tabs).toContain('注册')
    expect(wrapper.find('.github-btn').exists()).toBe(true)
  })

  it('点击 GitHub 按钮跳转到后端授权端点', async () => {
    const { wrapper } = mountView()

    await wrapper.find('.github-btn').trigger('click')

    expect(locationMock.href).toBe('http://localhost:8082/oauth2/authorization/github')
  })

  it('「忘记密码？」切到重置密码 tab', async () => {
    const { wrapper } = mountView()

    await wrapper.find('.forgot-link').trigger('click')
    await flushPromises()

    const activeTab = wrapper.find('.el-tabs__item.is-active')
    expect(activeTab.text()).toBe('重置密码')
    // 重置表单渲染：邮箱 / 验证码 / 新密码 / 确认密码
    const pane = wrapper.findAll('.el-tab-pane').find(p => p.text().includes('确认密码'))
    expect(pane).toBeTruthy()
    expect(pane.findAll('input').length).toBe(4)
  })

  it('重置密码两次输入不一致时校验失败，不提交', async () => {
    const { wrapper, auth } = mountView()
    auth.resetPassword = vi.fn()

    await wrapper.find('.forgot-link').trigger('click')
    await flushPromises()

    const pane = wrapper.findAll('.el-tab-pane').find(p => p.text().includes('确认密码'))
    const inputs = pane.findAll('input')
    await inputs[0].setValue('a@b.com')
    await inputs[1].setValue('123456')
    await inputs[2].setValue('newpass1')
    await inputs[3].setValue('newpass2')

    const submitBtn = pane.findAll('button').find(b => b.text() === '重置密码')
    await submitBtn.trigger('click')
    await flushPromises()
    // EP 错误提示经 ~100ms debounce 渲染（validateStateDebounced）
    await new Promise(r => setTimeout(r, 150))
    await flushPromises()

    expect(auth.resetPassword).not.toHaveBeenCalled()
    expect(pane.text()).toContain('两次输入的密码不一致')
  })

  it('重置成功：调用 resetPassword 并切回登录 tab', async () => {
    const { wrapper, auth } = mountView()
    auth.resetPassword = vi.fn().mockResolvedValue(undefined)

    await wrapper.find('.forgot-link').trigger('click')
    await flushPromises()

    const pane = wrapper.findAll('.el-tab-pane').find(p => p.text().includes('确认密码'))
    const inputs = pane.findAll('input')
    await inputs[0].setValue('a@b.com')
    await inputs[1].setValue('123456')
    await inputs[2].setValue('newpass1')
    await inputs[3].setValue('newpass1')

    const submitBtn = pane.findAll('button').find(b => b.text() === '重置密码')
    await submitBtn.trigger('click')
    await flushPromises()

    expect(auth.resetPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      code: '123456',
      newPassword: 'newpass1'
    })
    expect(wrapper.find('.el-tabs__item.is-active').text()).toBe('登录')
  })
})
