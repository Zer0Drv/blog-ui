import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import MyArticlesView from '../MyArticlesView.vue'
import { pageMyArticles, importArticle, exportArticle } from '../../api/article'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

vi.mock('../../api/article', () => ({
  pageMyArticles: vi.fn(),
  importArticle: vi.fn(),
  exportArticle: vi.fn(),
  deleteArticle: vi.fn(),
  forceDeleteArticle: vi.fn(),
  restoreArticle: vi.fn(),
  updateArticleStatus: vi.fn()
}))

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(MyArticlesView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
}

// 向隐藏 file input 注入文件并触发 change
async function chooseFile(wrapper, file) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('MyArticlesView 导入文章', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    pageMyArticles.mockResolvedValue({ records: [], total: 0 })
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
  })

  it('拒绝不支持的扩展名，不发起导入请求', async () => {
    const wrapper = mountView()
    await flushPromises()

    await chooseFile(wrapper, new File(['x'], 'note.pdf'))

    expect(importArticle).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('仅支持 .md/.markdown/.txt/.html/.htm 文件')
    wrapper.unmount()
  })

  it('拒绝超过 2MB 的文件，不发起导入请求', async () => {
    const wrapper = mountView()
    await flushPromises()

    const big = new File(['x'], 'big.md')
    Object.defineProperty(big, 'size', { value: 2 * 1024 * 1024 + 1 })
    await chooseFile(wrapper, big)

    expect(importArticle).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('文件大小不能超过 2MB')
    wrapper.unmount()
  })

  it('导入成功：提示并跳转到新草稿的编辑页', async () => {
    importArticle.mockResolvedValue({ id: 42, status: 'DRAFT' })
    const wrapper = mountView()
    await flushPromises()

    await chooseFile(wrapper, new File(['# hi'], 'draft.md'))

    expect(importArticle).toHaveBeenCalledTimes(1)
    expect(importArticle.mock.calls[0][0]).toBeInstanceOf(File)
    expect(ElMessage.success).toHaveBeenCalledWith('导入成功，已创建草稿')
    expect(routerPush).toHaveBeenCalledWith('/editor/42')
    wrapper.unmount()
  })

  it('导入失败（后端业务码已由拦截器提示）：不跳转', async () => {
    importArticle.mockRejectedValue(Object.assign(new Error('文件过大'), { code: '40010' }))
    const wrapper = mountView()
    await flushPromises()

    await chooseFile(wrapper, new File(['# hi'], 'draft.md'))

    expect(importArticle).toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('MyArticlesView 行内导出', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    pageMyArticles.mockResolvedValue({
      records: [
        { id: 1, title: 'MD 文章', status: 'DRAFT', editorType: 'MARKDOWN', updateTime: '2024-01-01 10:00' },
        { id: 2, title: '富文本文章', status: 'PUBLISHED', editorType: 'RICHTEXT', updateTime: '2024-01-02 10:00' }
      ],
      total: 2
    })
    exportArticle.mockResolvedValue(undefined)
  })

  it('按编辑器类型以默认格式导出（MARKDOWN→md / RICHTEXT→html）', async () => {
    const wrapper = mountView()
    await flushPromises()

    // el-table 的 hidden-columns 测量节点会渲染一份隐藏克隆，需排除
    const exportButtons = wrapper.findAll('button')
      .filter(b => b.text().trim() === '导出' && !b.element.closest('.hidden-columns'))
    expect(exportButtons.length).toBe(2)

    await exportButtons[0].trigger('click')
    await exportButtons[1].trigger('click')
    await flushPromises()

    expect(exportArticle).toHaveBeenCalledWith(1, 'md')
    expect(exportArticle).toHaveBeenCalledWith(2, 'html')
    wrapper.unmount()
  })
})
