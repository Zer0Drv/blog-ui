import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import MyFavoritesView from '../MyFavoritesView.vue'
import { pageMyFavorites } from '../../api/interaction'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: mocks.push, replace: vi.fn() })
}))

vi.mock('../../api/interaction', () => ({
  pageMyFavorites: vi.fn()
}))

vi.mock('../../api/upload', () => ({ resolveUploadUrl: v => v }))

function article(id, overrides = {}) {
  return {
    id,
    title: `文章${id}`,
    summary: `摘要${id}`,
    cover: '',
    author: { id: 2, username: 'bob' },
    publishTime: '2024-01-01T00:00:00',
    tags: [],
    ...overrides
  }
}

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(MyFavoritesView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper }
}

describe('MyFavoritesView 已下架文章置灰', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    pageMyFavorites.mockResolvedValue({
      records: [
        article(1, { visible: false }),
        article(2, { visible: true }),
        article(3) // 旧后端无 visible 字段：按可见处理
      ],
      total: 3
    })
  })

  it('visible=false：卡片置灰 + 「已下架」角标，标题/收藏时间等正常显示', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const cards = wrapper.findAll('.article-card')
    expect(cards.length).toBe(3)

    const offline = cards[0]
    expect(offline.classes()).toContain('is-offline')
    expect(offline.find('.offline-badge').exists()).toBe(true)
    expect(offline.find('.offline-badge').text()).toBe('已下架')
    // 其余字段正常渲染
    expect(offline.text()).toContain('文章1')
    expect(offline.text()).toContain('bob')
    expect(offline.text()).toContain('2024-01-01 00:00')
    wrapper.unmount()
  })

  it('visible=false：点击不跳转详情，提示「文章已下架」', async () => {
    const warning = vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
    const { wrapper } = mountView()
    await flushPromises()

    await wrapper.findAll('.article-card')[0].trigger('click')

    expect(mocks.push).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledWith('文章已下架')
    warning.mockRestore()
    wrapper.unmount()
  })

  it('visible=true 或无 visible 字段：不置灰无角标，点击正常跳转', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const cards = wrapper.findAll('.article-card')
    for (const card of [cards[1], cards[2]]) {
      expect(card.classes()).not.toContain('is-offline')
      expect(card.find('.offline-badge').exists()).toBe(false)
    }

    await cards[1].trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/article/2')
    await cards[2].trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/article/3')
    wrapper.unmount()
  })
})
