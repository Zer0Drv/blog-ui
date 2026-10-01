import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import LoginView from '../LoginView.vue'
import { useAuthStore } from '../../stores/auth'
import http from '../../api/http'
import { CAPTCHA_REQUIRED_CODE, getCaptcha } from '../../api/captcha'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))

vi.mock('../../api/http', () => ({
  default: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() }
}))

// 保留真实 CAPTCHA_REQUIRED_CODE 码值，仅 mock 取图接口
vi.mock('../../api/captcha', async importOriginal => {
  const mod = await importOriginal()
  return { ...mod, getCaptcha: vi.fn() }
})

function captchaError() {
  return Object.assign(new Error('操作过于频繁，请先完成验证'), { code: CAPTCHA_REQUIRED_CODE })
}

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(LoginView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper, auth: useAuthStore() }
}

async function fillLoginForm(wrapper) {
  const pane = wrapper.findAll('.el-tab-pane')[0]
  await pane.find('input[autocomplete="username"]').setValue('alice')
  await pane.find('input[type="password"]').setValue('secret1')
}

function loginButton(wrapper) {
  return wrapper.findAll('button').find(b => b.text() === '登录')
}

describe('LoginView 验证码链路（CAPTCHA_REQUIRED）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    getCaptcha.mockResolvedValue({ captchaId: 'cid-1', imageBase64: 'data:image/png;base64,AAA' })
  })

  it('初始不渲染验证码；登录返回 CAPTCHA_REQUIRED 码值后显示', async () => {
    const { wrapper } = mountView()
    http.post.mockRejectedValueOnce(captchaError())

    expect(wrapper.find('.captcha-input').exists()).toBe(false)

    await fillLoginForm(wrapper)
    await loginButton(wrapper).trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenCalledWith('/auth/login', {
      username: 'alice',
      password: 'secret1'
    })
    expect(wrapper.find('.captcha-input').exists()).toBe(true)
    // CaptchaInput 挂载后自动取图（scene=login）
    expect(getCaptcha).toHaveBeenCalledWith('login')
  })

  it('其他错误码不触发验证码', async () => {
    const { wrapper } = mountView()
    http.post.mockRejectedValueOnce(Object.assign(new Error('密码错误'), { code: '40001' }))

    await fillLoginForm(wrapper)
    await loginButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.captcha-input').exists()).toBe(false)
  })

  it('带验证码重试：请求体并入 captchaId/captchaCode，成功后拉取会话并隐藏清空', async () => {
    const { wrapper, auth } = mountView()
    auth.fetchMe = vi.fn().mockResolvedValue(undefined)
    http.post.mockRejectedValueOnce(captchaError())

    await fillLoginForm(wrapper)
    await loginButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('.captcha-input').exists()).toBe(true)

    // 登录成功：后端 Set-Cookie（AUTH_TOKEN），前端只拉 /auth/me 建会话（#13）
    http.post.mockResolvedValueOnce({})
    await loginButton(wrapper).trigger('click')
    await flushPromises()

    expect(http.post).toHaveBeenLastCalledWith('/auth/login', {
      username: 'alice',
      password: 'secret1',
      captchaId: 'cid-1',
      captchaCode: ''
    })
    expect(auth.fetchMe).toHaveBeenCalled()
    expect(wrapper.find('.captcha-input').exists()).toBe(false)
  })
})
