import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import UserProfileView from '../UserProfileView.vue'
import { useAuthStore } from '../../stores/auth'
import { getUserProfile, pageUserArticles, listFollowers, listFollowing } from '../../api/social'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '2' }, query: {} }),
  useRouter: () => ({ push: routerPush, replace: vi.fn() })
}))

vi.mock('../../api/social', () => ({
  getUserProfile: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
  pageUserArticles: vi.fn(),
  listFollowers: vi.fn(),
  listFollowing: vi.fn()
}))

vi.mock('../../api/upload', () => ({ resolveUploadUrl: v => v }))

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(UserProfileView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper, auth: useAuthStore() }
}

describe('UserProfileView 粉丝/关注弹窗与发私信', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    getUserProfile.mockResolvedValue({
      id: 2,
      username: 'bob',
      nickname: 'Bob',
      bio: '',
      followerCount: 3,
      followingCount: 5,
      articleCount: 0,
      followed: false
    })
    pageUserArticles.mockResolvedValue({ records: [], total: 0 })
    listFollowers.mockResolvedValue({ records: [{ id: 3, username: 'ann', nickname: 'Ann' }], total: 1 })
    listFollowing.mockResolvedValue({ records: [{ id: 4, username: 'cat', nickname: 'Cat' }], total: 1 })
  })

  it('点击「粉丝」打开弹窗并分页拉取粉丝列表', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const followersStat = wrapper.findAll('.stats .clickable').find(s => s.text().includes('粉丝'))
    await followersStat.trigger('click')
    await flushPromises()

    expect(listFollowers).toHaveBeenCalledWith('2', 1, 10)
    const dialog = document.body.querySelector('.el-dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain('粉丝')
    expect(dialog.textContent).toContain('Ann')
    wrapper.unmount()
  })

  it('点击「关注」打开弹窗并拉取关注列表', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const followingStat = wrapper.findAll('.stats .clickable').find(s => s.text().includes('关注'))
    await followingStat.trigger('click')
    await flushPromises()

    expect(listFollowing).toHaveBeenCalledWith('2', 1, 10)
    const dialog = document.body.querySelector('.el-dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.textContent).toContain('Cat')
    wrapper.unmount()
  })

  it('点击「发私信」跳转 /messages?peerId=<userId>', async () => {
    const { wrapper, auth } = mountView()
    auth.token = 'tok' // isLoggedIn
    await flushPromises()

    const sendBtn = wrapper.findAll('button').find(b => b.text() === '发私信')
    await sendBtn.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/messages?peerId=2')
    wrapper.unmount()
  })

  it('未登录点击「发私信」先跳登录页', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const sendBtn = wrapper.findAll('button').find(b => b.text() === '发私信')
    await sendBtn.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/login')
    wrapper.unmount()
  })
})
