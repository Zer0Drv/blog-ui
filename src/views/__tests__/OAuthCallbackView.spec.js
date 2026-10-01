import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import OAuthCallbackView from '../OAuthCallbackView.vue'

const route = { query: {} }
const replaceMock = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace: replaceMock, push: vi.fn() })
}))

const authMock = vi.hoisted(() => ({
  exchangeOAuthCode: vi.fn()
}))
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

function mountView() {
  return mount(OAuthCallbackView, {
    global: { plugins: [ElementPlus] }
  })
}

describe('OAuthCallbackView（一次性 code 换 Cookie 会话，#13）', () => {
  beforeEach(() => {
    route.query = {}
    vi.clearAllMocks()
    authMock.exchangeOAuthCode.mockResolvedValue(undefined)
  })

  it('无 code：提示失败并跳回登录页', async () => {
    mountView()
    await flushPromises()

    expect(authMock.exchangeOAuthCode).not.toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })

  it('有 code：换取会话成功后回首页', async () => {
    route.query = { code: 'oauth-code-123' }
    mountView()
    await flushPromises()

    expect(authMock.exchangeOAuthCode).toHaveBeenCalledWith('oauth-code-123')
    expect(replaceMock).toHaveBeenCalledWith('/')
  })

  it('code 无效/过期（exchange 400/401）：提示并跳回登录页', async () => {
    route.query = { code: 'expired-code' }
    authMock.exchangeOAuthCode.mockRejectedValue(new Error('401'))
    mountView()
    await flushPromises()

    expect(authMock.exchangeOAuthCode).toHaveBeenCalledWith('expired-code')
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })
})
