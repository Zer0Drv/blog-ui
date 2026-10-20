import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import MainLayout from '../../layouts/MainLayout.vue'
import ArticleEditView from '../ArticleEditView.vue'
import { useAuthStore } from '../../stores/auth'
import { autosaveArticle, createArticle, getArticle, getAutosave, importArticle, updateArticle } from '../../api/article'
import { DRAFT_NEW_KEY } from '../../utils/articleEdit'

// 路由、布局、编辑页与自动保存均使用真实实现，只替换网络与重型编辑器。
vi.mock('../../lib/mdEditorConfig', () => ({}))
vi.mock('md-editor-v3', () => ({ MdEditor: {
  props: ['modelValue', 'editorId'], emits: ['update:modelValue'],
  template: '<textarea data-editor="md" :data-id="editorId" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
} }))
vi.mock('../../components/RichEditor.vue', () => ({ default: {
  props: ['modelValue'], emits: ['update:modelValue'],
  template: '<textarea data-editor="html" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
} }))
vi.mock('../../components/AttachmentPicker.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/VersionHistoryDrawer.vue', () => ({ default: {
  emits: ['restored'], template: '<button data-restore @click="$emit(\'restored\')">恢复版本</button>'
} }))
vi.mock('../../api/article', () => ({
  autosaveArticle: vi.fn(), createArticle: vi.fn(), exportArticle: vi.fn(),
  getArticle: vi.fn(), getAutosave: vi.fn(), importArticle: vi.fn(), updateArticle: vi.fn()
}))
vi.mock('../../api/category', () => ({ listCategories: vi.fn().mockResolvedValue([
  { id: 11, name: '分类 A' }, { id: 22, name: '分类 B' }
]) }))
vi.mock('../../api/tag', () => ({ listTags: vi.fn().mockResolvedValue([]) }))
vi.mock('../../api/page', () => ({ getPageNavigation: vi.fn().mockResolvedValue([]) }))
vi.mock('../../api/site', () => ({ getSiteConfig: vi.fn().mockResolvedValue({}) }))
vi.mock('../../api/notification', () => ({ getUnreadCount: vi.fn().mockResolvedValue({ count: 0 }) }))
vi.mock('../../api/upload', () => ({ resolveUploadUrl: u => u, uploadAndResolveUrl: vi.fn(), uploadImage: vi.fn() }))
vi.mock('../../composables/useRealtimeTopic', () => ({ useRealtimeTopic: vi.fn() }))
vi.mock('../../stores/realtime', () => ({ useRealtimeStore: () => ({ connect: vi.fn(), disconnect: vi.fn() }) }))

const articles = {
  1: { id: 1, title: '文章 A', slug: 'article-a', summary: '摘要 A', content: '# A', categoryId: 11,
    editorType: 'MARKDOWN', visibility: 'PUBLIC', author: { id: 7 } },
  2: { id: 2, title: '文章 B', slug: 'article-b', summary: '摘要 B', content: '<p>B</p>', categoryId: 22,
    editorType: 'RICHTEXT', visibility: 'PRIVATE', author: { id: 7 } }
}
let wrapper

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function open(path = '/editor/1') {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { id: 7, role: 'AUTHOR', nickname: '作者' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: MainLayout, children: [
      { path: 'editor/new', name: 'editor-new', component: ArticleEditView },
      { path: 'editor/:id', name: 'editor-edit', component: ArticleEditView },
      { path: 'my/articles', name: 'my-articles', component: { template: '<div>文章列表</div>' } }
    ] }, { path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(defineComponent({ components: { RouterView }, template: '<RouterView />' }), {
    global: { plugins: [pinia, router, ElementPlus] }, attachTo: document.body
  })
  await flushPromises()
  return router
}

function button(text) {
  return wrapper.findAll('.actions button').find(b => b.text().trim() === text)
}

function expectArticle(id) {
  const a = articles[id]
  expect(wrapper.find('input[placeholder="请输入文章标题"]').element.value).toBe(a.title)
  expect(wrapper.find('input[placeholder^="留空自动生成"]').element.value).toBe(a.slug)
  expect(wrapper.find('textarea[placeholder="留空则自动截取正文前 200 字"]').element.value).toBe(a.summary)
  expect(wrapper.find(`[data-editor="${id === 1 ? 'md' : 'html'}"]`).element.value).toBe(a.content)
  expect(wrapper.find(`[data-editor="${id === 1 ? 'html' : 'md'}"]`).exists()).toBe(false)
  expect(wrapper.find(`input[type="radio"][value="${a.visibility}"]`).element.checked).toBe(true)
  expect(wrapper.findComponent({ name: 'ElTreeSelect' }).props('modelValue')).toBe(a.categoryId)
}

describe('编辑器文章生命周期（真实 Vue Router，#51 / #52）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    getArticle.mockImplementation(id => Promise.resolve({ ...articles[id] }))
    getAutosave.mockResolvedValue({ exists: false })
    autosaveArticle.mockResolvedValue({ savedAt: Date.now() })
    updateArticle.mockResolvedValue(undefined)
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('A → 导入 B：重建表单与编辑器，A 未到点的修改先保存到 A', async () => {
    const router = await open()
    expectArticle(1)
    await wrapper.find('[data-editor="md"]').setValue('# A 修改')
    importArticle.mockResolvedValue({ imported: [{ id: 2, title: '文章 B', warnings: [], externalImages: [] }], failed: [] })
    const input = wrapper.find('input[accept=".md,.markdown,.txt,.html,.htm,.zip"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['<p>B</p>'], 'b.html')], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/editor/2')
    expectArticle(2)
    expect(autosaveArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# A 修改', categoryId: 11 }))
    await wrapper.find('[data-editor="html"]').setValue('<p>B 修改</p>')
    await vi.advanceTimersByTimeAsync(30000)
    expect(autosaveArticle).toHaveBeenLastCalledWith('2', expect.objectContaining({ content: '<p>B 修改</p>', categoryId: 22 }))
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(updateArticle).toHaveBeenCalledWith('2', expect.objectContaining({
      slug: 'article-b', editorType: 'RICHTEXT', visibility: 'PRIVATE', categoryId: 22, content: '<p>B 修改</p>'
    }))
  })

  it('A → B → 后退 A → 前进 B：每次都加载对应正文和元数据', async () => {
    const router = await open()
    await router.push('/editor/2')
    await flushPromises()
    expectArticle(2)
    router.back()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/editor/1')
    expectArticle(1)
    router.forward()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/editor/2')
    expectArticle(2)
    expect(autosaveArticle).not.toHaveBeenCalled()
  })

  it('切换等待在途 A 保存与最新修改落轨，B 加载前不能提交旧表单', async () => {
    const first = deferred()
    const loadB = deferred()
    autosaveArticle.mockReturnValueOnce(first.promise)
    const router = await open()
    await wrapper.find('[data-editor="md"]').setValue('# A 旧修改')
    await vi.advanceTimersByTimeAsync(30000)
    await wrapper.find('[data-editor="md"]').setValue('# A 最新修改')
    getArticle.mockImplementation(id => id === '2' ? loadB.promise : Promise.resolve(articles[id]))
    const navigation = router.push('/editor/2')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/editor/1')
    expect(autosaveArticle).toHaveBeenCalledTimes(1)
    first.resolve({})
    await navigation
    await flushPromises()
    expect(autosaveArticle.mock.calls.map(([id, b]) => [id, b.content])).toEqual([
      ['1', '# A 旧修改'], ['1', '# A 最新修改']
    ])
    expect(wrapper.find('input[placeholder="请输入文章标题"]').element.value).toBe('')
    expect(button('保存草稿').element.disabled).toBe(true)
    await button('保存草稿').trigger('click')
    expect(updateArticle).not.toHaveBeenCalled()
    loadB.resolve(articles[2])
    await flushPromises()
    expectArticle(2)
    await vi.advanceTimersByTimeAsync(60000)
    expect(autosaveArticle).toHaveBeenCalledTimes(2)
  })

  it('A 初始响应晚于 B：不回填 B，也不向 B 自动保存 A', async () => {
    const loadA = deferred()
    getArticle.mockImplementation(id => id === '1' ? loadA.promise : Promise.resolve(articles[id]))
    const router = await open()
    await router.push('/editor/2')
    await flushPromises()
    expectArticle(2)
    loadA.resolve(articles[1])
    await flushPromises()
    expectArticle(2)
    expect(getAutosave.mock.calls.map(([id]) => id)).toEqual(['2'])
    await vi.advanceTimersByTimeAsync(60000)
    expect(autosaveArticle).not.toHaveBeenCalled()
  })

  it('A 草稿响应晚于 B：不再弹恢复提示或回填旧草稿', async () => {
    const draftA = deferred()
    getAutosave.mockImplementation(id => id === '1' ? draftA.promise : Promise.resolve({ exists: false }))
    const router = await open()
    await router.push('/editor/2')
    await flushPromises()
    draftA.resolve({ exists: true, savedAt: Date.now(), title: '旧草稿', content: '# 旧内容' })
    await flushPromises()
    expectArticle(2)
    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60000)
    expect(autosaveArticle).not.toHaveBeenCalled()
  })

  it('草稿保存失败且选择继续编辑：取消导航，保留 A 内容', async () => {
    const router = await open()
    await wrapper.find('[data-editor="md"]').setValue('# 未保存')
    autosaveArticle.mockRejectedValue(new Error('断网'))
    await router.push('/editor/2')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/editor/1')
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 未保存')
    expect(ElMessageBox.confirm).toHaveBeenCalledWith(expect.stringContaining('未能保存'), '未保存的修改', expect.any(Object))
    autosaveArticle.mockResolvedValue({})
    await router.push('/editor/2')
    await flushPromises()
    expectArticle(2)
  })

  it('新建首次保存：等待自动保存后清本地草稿，再跳转新 ID 加载服务端文章', async () => {
    const router = await open('/editor/new')
    await wrapper.find('input[placeholder="请输入文章标题"]').setValue('新文章')
    await wrapper.find('[data-editor="md"]').setValue('# 新正文')
    createArticle.mockResolvedValue(1)
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({ title: '新文章', content: '# 新正文' }))
    expect(router.currentRoute.value.path).toBe('/editor/1')
    expectArticle(1)
    expect(localStorage.getItem(DRAFT_NEW_KEY)).toBeNull()
    await vi.advanceTimersByTimeAsync(60000)
    expect(autosaveArticle).not.toHaveBeenCalled()
  })

  it('离开编辑页先保存到原文章；用户明确选择仍然离开时允许失败导航', async () => {
    const router = await open()
    await wrapper.find('[data-editor="md"]').setValue('# A 离开前修改')
    autosaveArticle.mockRejectedValue(new Error('断网'))
    ElMessageBox.confirm.mockResolvedValue('confirm')
    await router.push('/my/articles')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/my/articles')
    expect(autosaveArticle).toHaveBeenCalledTimes(1)
    expect(autosaveArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# A 离开前修改' }))
  })

  it('版本恢复回填不触发自动保存，之后的手动修改仍正常保存', async () => {
    await open()
    await wrapper.find('[data-editor="md"]').setValue('# 恢复前编辑')
    getArticle.mockResolvedValue({ ...articles[1], content: '# 历史版本' })
    await wrapper.find('[data-restore]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 历史版本')
    await vi.advanceTimersByTimeAsync(60000)
    expect(autosaveArticle).not.toHaveBeenCalled()
    await wrapper.find('[data-editor="md"]').setValue('# 恢复后编辑')
    await vi.advanceTimersByTimeAsync(30000)
    expect(autosaveArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# 恢复后编辑' }))
  })

  it('正式保存等待旧自动保存完成，防止清场后旧请求再写入草稿', async () => {
    const first = deferred()
    autosaveArticle.mockReturnValueOnce(first.promise)
    await open()
    await wrapper.find('[data-editor="md"]').setValue('# 修改')
    await vi.advanceTimersByTimeAsync(30000)
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(updateArticle).not.toHaveBeenCalled()
    first.resolve({})
    await flushPromises()
    expect(updateArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# 修改' }))
    expect(wrapper.find('.autosave-tip').exists()).toBe(false)
    await nextTick()
  })
})
