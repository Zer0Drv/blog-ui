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
  setToken: vi.fn(),
  fetchMe: vi.fn(),
  logout: vi.fn()
}))
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => authMock
}))

function mountView() {
  return mount(OAuthCallbackView, {
    global: { plugins: [ElementPlus] }
  })
}

describe('OAuthCallbackView', () => {
  beforeEach(() => {
    route.query = {}
    vi.clearAllMocks()
    authMock.fetchMe.mockResolvedValue({ id: 1, username: 'neo' })
  })

  it('无 token：提示失败并跳回登录页', async () => {
    mountView()
    await flushPromises()

    expect(authMock.setToken).not.toHaveBeenCalled()
    expect(authMock.fetchMe).not.toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })

  it('有 token：setToken + fetchMe 后回首页', async () => {
    route.query = { token: 'oauth-token-123' }
    mountView()
    await flushPromises()

    expect(authMock.setToken).toHaveBeenCalledWith('oauth-token-123')
    expect(authMock.fetchMe).toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/')
    expect(authMock.logout).not.toHaveBeenCalled()
  })

  it('fetchMe 失败：logout 并跳回登录页', async () => {
    route.query = { token: 'bad-token' }
    authMock.fetchMe.mockRejectedValue(new Error('401'))
    mountView()
    await flushPromises()

    expect(authMock.setToken).toHaveBeenCalledWith('bad-token')
    expect(authMock.logout).toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })
})
