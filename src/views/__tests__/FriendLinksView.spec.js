import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import FriendLinksView from '../FriendLinksView.vue'
import { getSiteConfig } from '../../api/site'
import { publishSiteConfig } from '../../composables/useSiteConfig'
vi.mock('../../api/site', () => ({ getSiteConfig: vi.fn() }))
import { getFriendLinks } from '../../api/friendlink'

vi.mock('../../api/friendlink', () => ({
  getFriendLinks: vi.fn()
}))

function link(id, overrides = {}) {
  return {
    id,
    name: `站点${id}`,
    url: `https://example${id}.com`,
    logo: '',
    description: `描述${id}`,
    sort: id,
    status: 1,
    ...overrides
  }
}

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(FriendLinksView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
}

describe('FriendLinksView 公开友链页（issue #17）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSiteConfig.mockResolvedValue({ 'site.friend_links_enabled': 'true' })
    publishSiteConfig({ 'site.friend_links_enabled': 'true' })
    document.body.innerHTML = ''
  })

  it('渲染启用的友链卡片（名称/描述/外链）', async () => {
    getFriendLinks.mockResolvedValue([link(1), link(2, { logo: 'https://example.com/logo.png' })])
    const wrapper = mountView()
    await flushPromises()

    const cards = wrapper.findAll('.link-card')
    expect(cards.length).toBe(2)
    expect(cards[0].attributes('href')).toBe('https://example1.com')
    expect(cards[0].attributes('target')).toBe('_blank')
    expect(wrapper.text()).toContain('站点1')
    expect(wrapper.text()).toContain('描述2')
    // 无 logo 时渲染首字符占位
    expect(cards[0].find('.link-logo.placeholder').text()).toBe('站')
    wrapper.unmount()
  })

  it('关闭时直接访问不请求列表，重新开启后加载', async () => {
    getSiteConfig.mockResolvedValue({ 'site.friend_links_enabled': 'false' })
    getFriendLinks.mockResolvedValue([link(1)])
    const wrapper = mountView()
    await flushPromises()
    expect(getFriendLinks).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('本站暂未开放友情链接')
    getSiteConfig.mockResolvedValue({ 'site.friend_links_enabled': 'true' })
    publishSiteConfig({ 'site.friend_links_enabled': 'true' })
    await flushPromises()
    expect(wrapper.findAll('.link-card')).toHaveLength(1)
    publishSiteConfig({ 'site.friend_links_enabled': 'false' })
    await flushPromises()
    expect(wrapper.findAll('.link-card')).toHaveLength(0)
    wrapper.unmount()
  })

  it('空列表展示空态', async () => {
    getFriendLinks.mockResolvedValue([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.link-card').length).toBe(0)
    expect(wrapper.text()).toContain('暂无友情链接')
    wrapper.unmount()
  })

  it('接口失败时静默（拦截器已提示），页面停留在空态', async () => {
    getFriendLinks.mockRejectedValue(new Error('network'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.link-card').length).toBe(0)
    wrapper.unmount()
  })
})
