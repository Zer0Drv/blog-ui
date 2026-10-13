import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import AdminArticles from '../admin/AdminArticles.vue'
import { pageAdminArticles } from '../../api/admin'
import { exportArticlesZip } from '../../api/article'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('../../api/admin', () => ({
  pageAdminArticles: vi.fn(),
  offlineArticle: vi.fn(),
  setArticleRecommended: vi.fn(),
  setArticleTop: vi.fn()
}))

vi.mock('../../api/article', () => ({
  forceDeleteArticle: vi.fn(),
  exportArticlesZip: vi.fn()
}))

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(AdminArticles, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
}

const ROWS = [
  { id: 1, title: '第一篇', status: 'PUBLISHED', author: { nickname: '甲' }, slug: 'post-1' },
  { id: 2, title: '第二篇', status: 'DRAFT', author: { nickname: '乙' }, slug: 'post-2' }
]

describe('AdminArticles 批量导出', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    pageAdminArticles.mockResolvedValue({ records: ROWS, total: 2 })
    exportArticlesZip.mockResolvedValue(undefined)
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
  })

  // 批量导出按钮（排除 el-table hidden-columns 的隐藏克隆）
  function batchButton(wrapper) {
    return wrapper.findAll('button')
      .find(b => b.text().includes('批量导出') && !b.element.closest('.hidden-columns'))
  }

  async function selectRow(wrapper, rowIndex) {
    const checkbox = wrapper.findAll('tbody tr')[rowIndex].find('.el-checkbox')
    await checkbox.trigger('click')
    await flushPromises()
  }

  it('未勾选时按钮禁用；勾选后显示数量并调批量导出接口', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(batchButton(wrapper).attributes('disabled')).toBeDefined()

    await selectRow(wrapper, 0)
    await selectRow(wrapper, 1)
    expect(batchButton(wrapper).text()).toContain('（2）')

    await batchButton(wrapper).trigger('click')
    await flushPromises()

    expect(exportArticlesZip).toHaveBeenCalledWith([1, 2])
    wrapper.unmount()
  })

  it('只勾选一行时导出单篇 id', async () => {
    const wrapper = mountView()
    await flushPromises()

    await selectRow(wrapper, 1)
    await batchButton(wrapper).trigger('click')
    await flushPromises()

    expect(exportArticlesZip).toHaveBeenCalledWith([2])
    wrapper.unmount()
  })

  it('导出失败（拦截器已提示）：loading 复位可重试', async () => {
    exportArticlesZip.mockRejectedValue(new Error('boom'))
    const wrapper = mountView()
    await flushPromises()

    await selectRow(wrapper, 0)
    await batchButton(wrapper).trigger('click')
    await flushPromises()

    expect(exportArticlesZip).toHaveBeenCalledWith([1])
    expect(batchButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
