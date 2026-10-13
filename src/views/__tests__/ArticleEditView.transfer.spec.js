import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import ArticleEditView from '../ArticleEditView.vue'
import { exportArticle, getArticle, getAutosave, importArticle } from '../../api/article'
import { useAuthStore } from '../../stores/auth'

const routerPush = vi.hoisted(() => vi.fn())
const routerReplace = vi.hoisted(() => vi.fn())
const routeParams = vi.hoisted(() => ({ id: undefined }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ push: routerPush, replace: routerReplace })
}))

// 重型编辑器组件与样式在 jsdom 无意义，全部 stub
vi.mock('md-editor-v3', () => ({ MdEditor: { template: '<div />' } }))
vi.mock('../../components/RichEditor.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/AttachmentPicker.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/VersionHistoryDrawer.vue', () => ({ default: { template: '<div />' } }))

vi.mock('../../api/article', () => ({
  createArticle: vi.fn(),
  exportArticle: vi.fn(),
  getArticle: vi.fn(),
  getAutosave: vi.fn(),
  importArticle: vi.fn(),
  updateArticle: vi.fn(),
  autosaveArticle: vi.fn()
}))
vi.mock('../../api/category', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('../../api/tag', () => ({ listTags: vi.fn().mockResolvedValue([]) }))
vi.mock('../../api/upload', () => ({
  resolveUploadUrl: vi.fn(u => u),
  uploadAndResolveUrl: vi.fn(),
  uploadImage: vi.fn()
}))
// 实时推送在 auth store _applyUser 链路外（本测试直接赋值 state，不触发）；realtime store 替身兜底
vi.mock('../../stores/realtime', () => ({
  useRealtimeStore: () => ({ connect: vi.fn(), disconnect: vi.fn() })
}))

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 7, role: 'AUTHOR', nickname: '作者' }
  return mount(ArticleEditView, {
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
}

// 操作区按钮（视图无 el-table，无需排除隐藏克隆）
function actionButton(wrapper, text) {
  return wrapper.findAll('.actions button').find(b => b.text().trim() === text)
}

async function chooseFile(wrapper, file) {
  // 封面 el-upload 内部也有隐藏 file input，按导入框独有的 accept 精确定位
  const input = wrapper.find('input[type="file"][accept=".md,.markdown,.txt,.html,.htm,.zip"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('ArticleEditView 导入/导出入口（Zer0Drv/blog#16）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    localStorage.clear()
    routeParams.id = undefined
    exportArticle.mockResolvedValue(undefined)
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
  })

  it('新建页：有「导入」入口，无「导出」（文章尚未保存）', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(actionButton(wrapper, '导入')).toBeTruthy()
    expect(actionButton(wrapper, '导出')).toBeUndefined()
    expect(getArticle).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('编辑页：有「导出」入口，点击按编辑器类型导出当前文章', async () => {
    routeParams.id = '42'
    getArticle.mockResolvedValue({
      id: 42, title: '我的文章', summary: '', cover: '', categoryId: null,
      tagIds: [], editorType: 'MARKDOWN', content: '# 正文', status: 'DRAFT',
      author: { id: 7 }, updateTime: '2026-01-01T10:00:00'
    })
    getAutosave.mockResolvedValue({ exists: false })
    const wrapper = mountView()
    await flushPromises()

    const exportBtn = actionButton(wrapper, '导出')
    expect(exportBtn).toBeTruthy()
    await exportBtn.trigger('click')
    await flushPromises()

    expect(exportArticle).toHaveBeenCalledWith('42', 'md')
    wrapper.unmount()
  })

  it('导入成功：经共享导入逻辑创建草稿并跳转到其编辑页', async () => {
    importArticle.mockResolvedValue({
      imported: [{ id: 99, title: '导入草稿', warnings: [], externalImages: [] }],
      failed: []
    })
    const wrapper = mountView()
    await flushPromises()

    await chooseFile(wrapper, new File(['# hi'], 'draft.md'))

    expect(importArticle).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).toHaveBeenCalledWith('导入成功，已创建草稿')
    expect(routerPush).toHaveBeenCalledWith('/editor/99')
    wrapper.unmount()
  })

  it('导入非法文件：前端拦截不发起请求', async () => {
    const wrapper = mountView()
    await flushPromises()

    await chooseFile(wrapper, new File(['x'], 'note.pdf'))

    expect(importArticle).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('仅支持 .md/.markdown/.txt/.html/.htm/.zip 文件')
    wrapper.unmount()
  })
})
