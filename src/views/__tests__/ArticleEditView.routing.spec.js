import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import MainLayout from '../../layouts/MainLayout.vue'
import ArticleEditView from '../ArticleEditView.vue'
import { useAuthStore } from '../../stores/auth'
import { autosaveArticle, createArticle, discardArticleWorkingCopy, getArticleEditing as getArticle, getAutosave, importArticle, publishArticle, restoreArticleVersion, updateArticle } from '../../api/article'
import { DRAFT_NEW_KEY } from '../../utils/articleEdit'
import { uploadAndResolveUrl, uploadImage } from '../../api/upload'

// 路由、布局、编辑页与自动保存均使用真实实现，只替换网络与重型编辑器。
vi.mock('../../lib/mdEditorConfig', () => ({}))
vi.mock('md-editor-v3', () => ({ MdEditor: {
  props: ['modelValue', 'editorId', 'onUploadImg'], emits: ['update:modelValue'],
  template: '<textarea data-editor="md" :data-id="editorId" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
} }))
vi.mock('../../components/RichEditor.vue', () => ({ default: {
  props: ['modelValue'], emits: ['update:modelValue'],
  template: '<textarea data-editor="html" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
} }))
vi.mock('../../components/AttachmentPicker.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../components/VersionHistoryDrawer.vue', () => ({ default: {
  emits: ['restore'], template: '<button data-restore @click="$emit(\'restore\', 1)">恢复版本</button>'
} }))
vi.mock('../../components/MdContentPreview.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../api/article', () => ({
  autosaveArticle: vi.fn(), createArticle: vi.fn(), exportArticle: vi.fn(),
  getArticleEditing: vi.fn(), getAutosave: vi.fn(), importArticle: vi.fn(), updateArticle: vi.fn(),
  publishArticle: vi.fn(), discardArticleWorkingCopy: vi.fn(), restoreArticleVersion: vi.fn()
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
    editorType: 'MARKDOWN', visibility: 'PUBLIC', author: { id: 7 }, editRevision: 0, activeStatus: 'DRAFT' },
  2: { id: 2, title: '文章 B', slug: 'article-b', summary: '摘要 B', content: '<p>B</p>', categoryId: 22,
    editorType: 'RICHTEXT', visibility: 'PRIVATE', author: { id: 7 }, editRevision: 0, activeStatus: 'DRAFT' }
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

describe('编辑器文章生命周期（真实 Vue Router，#51 / #52 / #93）', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    for (const request of [getArticle, getAutosave, autosaveArticle, updateArticle, publishArticle, discardArticleWorkingCopy, restoreArticleVersion]) request.mockReset()
    localStorage.clear()
    getArticle.mockImplementation(id => Promise.resolve({ ...articles[id] }))
    getAutosave.mockResolvedValue({ exists: false })
    autosaveArticle.mockImplementation(async (id, body) => ({ ...articles[id], ...body, activeStatus: body.status || articles[id].activeStatus, editRevision: body.editRevision + 1, hasWorkingCopy: true }))
    updateArticle.mockImplementation(async (id, body) => ({ ...articles[id], ...body, activeStatus: body.status, editRevision: body.editRevision + 1, hasWorkingCopy: body.status === 'PUBLISHED' }))
    publishArticle.mockImplementation(async (id, body) => ({ ...articles[id], ...body, activeStatus: 'PUBLISHED', editRevision: body.editRevision + 1, hasWorkingCopy: false }))
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
    first.resolve({ editRevision: 1, hasWorkingCopy: true, activeStatus: 'DRAFT' })
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
    autosaveArticle.mockResolvedValue({ editRevision: 1, hasWorkingCopy: true, activeStatus: 'DRAFT' })
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
    ElMessageBox.confirm.mockResolvedValue('confirm')
    restoreArticleVersion.mockResolvedValue({ ...articles[1], content: '# 历史版本', editRevision: 2 })
    await wrapper.find('[data-restore]').trigger('click')
    await flushPromises()
    expect(restoreArticleVersion).toHaveBeenCalledWith('1', 1, 1)
    autosaveArticle.mockClear()
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
    first.resolve({ editRevision: 1, hasWorkingCopy: true, activeStatus: 'DRAFT' })
    await flushPromises()
    expect(updateArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# 修改' }))
    expect(wrapper.find('.autosave-tip').exists()).toBe(false)
    await nextTick()
  })

  it('已有持久工作稿直接加载，跳过旧 Redis 恢复，保存使用自动保存回执的最新修订', async () => {
    getArticle.mockResolvedValue({ ...articles[1], content: '# 修改草稿', activeStatus: 'PUBLISHED', hasWorkingCopy: true, editRevision: 8 })
    autosaveArticle.mockImplementation(async (_id, body) => ({ ...body, activeStatus: 'PUBLISHED', hasWorkingCopy: true, editRevision: 9 }))
    await open()
    expect(getAutosave).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('存在未发布的修改草稿')
    await wrapper.find('[data-editor="md"]').setValue('# 再修改')
    await button('保存修改草稿').trigger('click')
    await flushPromises()
    expect(autosaveArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# 再修改', editRevision: 8 }))
    expect(updateArticle).toHaveBeenCalledWith('1', expect.objectContaining({ content: '# 再修改', editRevision: 9, status: 'PUBLISHED' }))
    expect(publishArticle).not.toHaveBeenCalled()
    expect(button('保存修改草稿')).toBeTruthy()
  })

  it('自动保存旧响应只更新修订，不回填正在输入的正文；下一次保存完整链接与标签', async () => {
    const first = deferred()
    autosaveArticle.mockReturnValueOnce(first.promise)
    await open()
    await wrapper.find('[data-editor="md"]').setValue('# 请求里的旧内容')
    await vi.advanceTimersByTimeAsync(30000)
    await wrapper.find('[data-editor="md"]').setValue('# 正在输入的新内容')
    await wrapper.find('input[placeholder^="留空自动生成"]').setValue('changed-address')
    wrapper.findAllComponents({ name: 'ElSelect' }).at(-1).vm.$emit('update:modelValue', [31, 32])
    first.resolve({ ...articles[1], content: '# 请求里的旧内容', editRevision: 7, hasWorkingCopy: true })
    await flushPromises()
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 正在输入的新内容')
    await vi.advanceTimersByTimeAsync(30000)
    expect(autosaveArticle).toHaveBeenLastCalledWith('1', expect.objectContaining({
      content: '# 正在输入的新内容', slug: 'changed-address', tagIds: [31, 32], editRevision: 7
    }))
  })

  it('冲突保留本地内容，对比不替换基准，只有明确重载才替换表单', async () => {
    await open()
    autosaveArticle.mockRejectedValueOnce(Object.assign(new Error('冲突'), { code: '40901' }))
    await wrapper.find('[data-editor="md"]').setValue('# 我的未发布修改')
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('本地修改已保留')
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 我的未发布修改')
    expect(updateArticle).not.toHaveBeenCalled()
    getArticle.mockResolvedValue({ ...articles[1], content: '# 服务器较新版', editRevision: 42, hasWorkingCopy: true })
    await wrapper.findAll('button').find(b => b.text() === '对比服务器版本').trigger('click')
    await flushPromises()
    expect(document.querySelector('textarea[aria-label="本地正文"]').value).toBe('# 我的未发布修改')
    expect(document.querySelector('textarea[aria-label="服务器正文"]').value).toBe('# 服务器较新版')
    await wrapper.findAll('button').find(b => b.text() === '重新加载最新稿').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 我的未发布修改')
    ElMessageBox.confirm.mockResolvedValue('confirm')
    await wrapper.findAll('button').find(b => b.text() === '重新加载最新稿').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 服务器较新版')
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(updateArticle).toHaveBeenCalledWith('1', expect.objectContaining({ editRevision: 42, content: '# 服务器较新版' }))
  })

  it('定时中文章明确更新发布仍保留计划，不发送新的发布时间', async () => {
    const scheduled = { ...articles[1], activeStatus: 'PUBLISHED', activePublishTime: '2099-01-01T10:00:00', hasWorkingCopy: true }
    getArticle.mockResolvedValue(scheduled)
    ElMessageBox.confirm.mockResolvedValue('confirm')
    await open()
    expect(wrapper.text()).toContain('保留此计划')
    await button('更新发布').trigger('click')
    await flushPromises()
    expect(publishArticle).toHaveBeenCalledWith('1', expect.objectContaining({ editRevision: 0, status: 'PUBLISHED' }))
    expect(publishArticle.mock.lastCall[1]).not.toHaveProperty('publishTime')
    expect(updateArticle).not.toHaveBeenCalled()
  })

  it('放弃工作稿无需先保存不完整的本地内容，并还原生效稿', async () => {
    getArticle.mockResolvedValue({ ...articles[1], activeStatus: 'PUBLISHED', hasWorkingCopy: true, editRevision: 4 })
    discardArticleWorkingCopy.mockResolvedValue({ ...articles[1], activeStatus: 'PUBLISHED', editRevision: 5, hasWorkingCopy: false })
    ElMessageBox.confirm.mockResolvedValue('confirm')
    await open()
    await wrapper.find('[data-editor="md"]').setValue('')
    await button('放弃修改').trigger('click')
    await flushPromises()
    expect(autosaveArticle).not.toHaveBeenCalled()
    expect(discardArticleWorkingCopy).toHaveBeenCalledWith('1', 4)
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# A')
    expect(button('放弃修改')).toBeUndefined()
    expect(publishArticle).not.toHaveBeenCalled()
  })

  it.each(['更新发布', '放弃修改', '恢复版本'])('迟到的「%s」确认不操作切换后的文章', async action => {
    getArticle.mockImplementation(id => Promise.resolve({ ...articles[id], activeStatus: 'PUBLISHED', hasWorkingCopy: true }))
    const confirmation = deferred()
    ElMessageBox.confirm.mockReturnValueOnce(confirmation.promise)
    const router = await open()
    if (action === '恢复版本') await wrapper.find('[data-restore]').trigger('click')
    else await button(action).trigger('click')
    await router.push('/editor/2')
    await flushPromises()
    confirmation.resolve('confirm')
    await flushPromises()
    expectArticle(2)
    expect(publishArticle).not.toHaveBeenCalled()
    expect(discardArticleWorkingCopy).not.toHaveBeenCalled()
    expect(restoreArticleVersion).not.toHaveBeenCalled()
  })

  it.each(['重新加载最新稿', '对比服务器版本'])('迟到的「%s」确认或读取不覆盖另一篇文章', async action => {
    const router = await open()
    // A clean form can discover a concurrent edit during preview without becoming dirty.
    getArticle.mockResolvedValueOnce({ ...articles[1], editRevision: 2 })
    await button('预览修改').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('较新版本')
    const pending = deferred()
    if (action === '重新加载最新稿') ElMessageBox.confirm.mockReturnValueOnce(pending.promise)
    else getArticle.mockReturnValueOnce(pending.promise)
    await wrapper.findAll('button').find(b => b.text() === action).trigger('click')
    await router.push('/editor/2')
    await flushPromises()
    pending.resolve(action === '重新加载最新稿' ? 'confirm' : { ...articles[1], editRevision: 50 })
    await flushPromises()
    expectArticle(2)
    expect(document.querySelector('textarea[aria-label="服务器正文"]')).toBeNull()
    await wrapper.find('[data-editor="html"]').setValue('<p>B 新内容</p>')
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(autosaveArticle).toHaveBeenLastCalledWith('2', expect.objectContaining({ editRevision: 0 }))
  })

  it('卸载后迟到的自动保存回执不改变下一篇文章的修订基准', async () => {
    const oldSave = deferred()
    autosaveArticle.mockReturnValueOnce(oldSave.promise)
    await open()
    await wrapper.find('[data-editor="md"]').setValue('# A 待保存')
    await vi.advanceTimersByTimeAsync(30000)
    wrapper.unmount()
    wrapper = null
    await open('/editor/2')
    oldSave.resolve({ ...articles[1], editRevision: 99, hasWorkingCopy: true })
    await flushPromises()
    expectArticle(2)
    await wrapper.find('[data-editor="html"]').setValue('<p>B 新内容</p>')
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(autosaveArticle).toHaveBeenLastCalledWith('2', expect.objectContaining({ editRevision: 0 }))
    expect(updateArticle).toHaveBeenLastCalledWith('2', expect.objectContaining({ editRevision: 1 }))
  })

  it('无效口令保存失败保留未保存状态；有效口令回执允许后续留空保留哈希', async () => {
    await open()
    await wrapper.find('input[type="radio"][value="PASSWORD"]').setValue(true)
    await wrapper.find('input[type="password"]').setValue('abc')
    autosaveArticle.mockRejectedValueOnce(new Error('访问口令长度不符合要求'))
    await vi.advanceTimersByTimeAsync(30000)
    expect(wrapper.find('.autosave-tip').text()).toContain('有未保存的修改')
    autosaveArticle.mockImplementation(async (_id, body) => ({ ...articles[1], ...body, editRevision: body.editRevision + 1,
      hasWorkingCopy: true, passwordConfigured: true }))
    await wrapper.find('input[type="password"]').setValue('valid-password')
    await vi.advanceTimersByTimeAsync(30000)
    expect(autosaveArticle).toHaveBeenLastCalledWith('1', expect.objectContaining({ accessPassword: 'valid-password', editRevision: 0 }))
    expect(wrapper.find('input[type="password"]').attributes('placeholder')).toContain('保留原口令')
    await wrapper.find('input[type="password"]').setValue('')
    await button('保存草稿').trigger('click')
    await flushPromises()
    expect(updateArticle).toHaveBeenCalledWith('1', expect.objectContaining({ visibility: 'PASSWORD', editRevision: 2 }))
    expect(updateArticle.mock.lastCall[1]).not.toHaveProperty('accessPassword')
  })

  it.each(['放弃修改', '恢复版本', '重新加载最新稿'])('「%s」替换表单后，迟到封面和 Markdown 上传不能重建旧工作稿', async action => {
    getArticle.mockResolvedValue({ ...articles[1], hasWorkingCopy: true })
    const saved = { ...articles[1], content: '# 替换后的内容', editRevision: 1, hasWorkingCopy: false }
    discardArticleWorkingCopy.mockResolvedValue(saved)
    restoreArticleVersion.mockResolvedValue(saved)
    ElMessageBox.confirm.mockResolvedValue('confirm')
    await open()
    const cover = deferred(), markdown = deferred()
    uploadImage.mockReturnValueOnce(cover.promise)
    uploadAndResolveUrl.mockReturnValueOnce(markdown.promise)
    const coverRequest = wrapper.findComponent({ name: 'ElUpload' }).props('httpRequest')({ file: new File(['x'], 'cover.png') })
    const editor = wrapper.findComponent(ArticleEditView).findComponent('[data-editor="md"]')
    const insert = vi.fn(urls => editor.vm.$emit('update:modelValue', `![old upload](${urls[0]})`))
    const markdownRequest = editor.props('onUploadImg')([new File(['x'], 'body.png')], insert)
    if (action === '恢复版本') await wrapper.find('[data-restore]').trigger('click')
    else if (action === '重新加载最新稿') {
      getArticle.mockResolvedValueOnce({ ...articles[1], editRevision: 3 })
      await button('预览修改').trigger('click')
      await flushPromises()
      getArticle.mockResolvedValueOnce(saved)
      await wrapper.findAll('button').find(b => b.text() === action).trigger('click')
    } else await button(action).trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-editor="md"]').element.value).toBe('# 替换后的内容')
    cover.resolve({ url: '/old-cover.png' })
    markdown.resolve('/old-body.png')
    await Promise.all([coverRequest, markdownRequest])
    await flushPromises()
    expect(insert).not.toHaveBeenCalled()
    expect(wrapper.find('.cover-preview').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(30000)
    expect(autosaveArticle).not.toHaveBeenCalled()
    expect(button('保存草稿').element.disabled).toBe(false)
  })
})
