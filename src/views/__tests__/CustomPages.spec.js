import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import PageDetailView from '../PageDetailView.vue'
import AdminPageEdit from '../admin/AdminPageEdit.vue'
import { createPage, getAdminPage, getPage, updatePage } from '../../api/page'

const routing = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), leave: vi.fn() }))
const params = reactive({ id: undefined, slug: 'about' })
vi.mock('vue-router', () => ({ useRoute: () => ({ params }), useRouter: () => routing, onBeforeRouteLeave: routing.leave, onBeforeRouteUpdate: vi.fn() }))
vi.mock('../../api/page', () => ({ createPage: vi.fn(), updatePage: vi.fn(), getAdminPage: vi.fn(), getPage: vi.fn(), notifyPageNavigationChanged: vi.fn() }))
vi.mock('../../api/upload', () => ({ uploadAndResolveUrl: vi.fn() }))
vi.mock('../../composables/useDocumentTitle', () => ({ useDocumentTitle: () => ({ setTitle: vi.fn() }) }))
vi.mock('md-editor-v3', () => ({ MdEditor: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea class="content-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' } }))
vi.mock('../../components/RichEditor.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/MdContentPreview.vue', () => ({ default: { props: ['content'], template: '<div class="markdown">{{ content }}</div>' } }))
const mountView = view => mount(view, { global: { plugins: [ElementPlus] } })
const button = (wrapper, text) => wrapper.findAll('button').find(b => b.text() === text)

describe('独立页面阅读和编辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params.id = undefined
    params.slug = 'about'
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
  })

  it('公开详情渲染 Markdown，切换 slug 后不保留旧页面', async () => {
    getPage.mockResolvedValueOnce({ id: 1, title: '关于', content: '# 关于内容', editorType: 'MARKDOWN' })
    const wrapper = mountView(PageDetailView)
    await flushPromises()
    expect(wrapper.text()).toContain('# 关于内容')
    getPage.mockRejectedValueOnce(new Error('not found'))
    params.slug = 'missing'
    await flushPromises()
    expect(getPage).toHaveBeenLastCalledWith('missing')
    expect(wrapper.text()).toContain('页面不存在或未发布')
    expect(wrapper.text()).not.toContain('# 关于内容')
    wrapper.unmount()
  })

  it('富文本阅读经过 DOMPurify 清洗', async () => {
    getPage.mockResolvedValue({ title: '关于', content: '<p>安全正文</p><script>alert(1)</script><img onerror="alert(1)">', editorType: 'RICHTEXT' })
    const wrapper = mountView(PageDetailView)
    await flushPromises()
    expect(wrapper.find('.richtext').html()).toContain('安全正文')
    expect(wrapper.find('.richtext').html()).not.toContain('script')
    expect(wrapper.find('.richtext').html()).not.toContain('onerror')
    wrapper.unmount()
  })

  it('新建页面校验必填字段并提交发布状态', async () => {
    createPage.mockResolvedValue(10)
    const wrapper = mountView(AdminPageEdit)
    await flushPromises()
    await button(wrapper, '发布页面').trigger('click')
    expect(createPage).not.toHaveBeenCalled()
    const inputs = wrapper.findAll('input.el-input__inner')
    await inputs[0].setValue('关于我们')
    await inputs[1].setValue('about')
    await wrapper.find('.content-input').setValue('# 页面正文')
    await button(wrapper, '发布页面').trigger('click')
    await flushPromises()
    expect(createPage).toHaveBeenCalledWith({ title: '关于我们', slug: 'about', content: '# 页面正文', editorType: 'MARKDOWN', status: 'PUBLISHED' })
    expect(routing.replace).toHaveBeenCalledWith('/admin/pages/10')
    wrapper.unmount()
  })

  it('管理员加载草稿使用管理接口，发布页面可下架；未保存修改离开需确认', async () => {
    params.id = '7'
    getAdminPage.mockResolvedValue({ title: '关于', slug: 'about', content: '# 正文', editorType: 'MARKDOWN', status: 'PUBLISHED' })
    updatePage.mockResolvedValue(7)
    const wrapper = mountView(AdminPageEdit)
    await flushPromises()
    expect(getAdminPage).toHaveBeenCalledWith('7')
    expect(getPage).not.toHaveBeenCalled()
    await button(wrapper, '下架').trigger('click')
    await flushPromises()
    expect(updatePage).toHaveBeenCalledWith('7', expect.objectContaining({ status: 'OFFLINE' }))
    await wrapper.find('.content-input').setValue('修改')
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel')
    expect(await routing.leave.mock.lastCall[0]()).toBe(false)
    wrapper.unmount()
  })
})
