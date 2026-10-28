import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import SeriesListView from '../SeriesListView.vue'
import SeriesDetailView from '../SeriesDetailView.vue'
import SeriesEditView from '../SeriesEditView.vue'
import MySeriesView from '../MySeriesView.vue'
import ArticleSeriesNavigation from '../../components/ArticleSeriesNavigation.vue'
import * as api from '../../api/series'

vi.mock('../../api/series', () => ({ pageSeries: vi.fn(), getSeries: vi.fn(), getArticleSeries: vi.fn(), pageManagedSeries: vi.fn(), getManagedSeries: vi.fn(), createSeries: vi.fn(), updateSeries: vi.fn(), deleteSeries: vi.fn(), pageSeriesCandidates: vi.fn() }))
vi.mock('../../api/upload', () => ({ resolveUploadUrl: value => value, uploadImage: vi.fn() }))
vi.mock('../../composables/useCurrentUser', () => ({ useCurrentUser: () => ({ isAdmin: { value: true } }) }))
vi.mock('../../composables/useDocumentTitle', () => ({ useDocumentTitle: () => ({ setTitle: vi.fn() }) }))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: vi.fn() } }))
const chapter = (id, visible = true) => ({ id, slug: `chapter-${id}`, title: `章节${id}`, visible, status: visible ? 'PUBLISHED' : 'DRAFT', visibility: 'PUBLIC' })
const detail = extra => ({ id: 7, title: '学习系列', slug: 'learning', description: '循序渐进', cover: '', status: 'PUBLISHED', revision: 4, ownerId: 2, ownerName: '作者', articleCount: 2, articles: [chapter(1), chapter(2)], ...extra })
const page = records => ({ records, total: records.length, page: 1, size: 10 })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let wrapper, router
async function open(path) {
  router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/series', component: SeriesListView }, { path: '/series/:slug', component: SeriesDetailView },
    { path: '/my/series', component: MySeriesView }, { path: '/my/series/new', component: SeriesEditView },
    { path: '/my/series/:id', component: SeriesEditView }, { path: '/article/:id', component: { template: '<div>文章</div>' } }
  ] })
  await router.push(path); await router.isReady()
  wrapper = mount(RouterView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}
const button = name => wrapper.findAll('button').find(node => node.text() === name)
const field = name => wrapper.findAll('label').find(label => label.text().startsWith(name)).find('input,textarea,select')
beforeEach(() => {
  vi.resetAllMocks()
  api.pageSeries.mockResolvedValue(page([detail()]))
  api.getSeries.mockResolvedValue(detail())
  api.pageManagedSeries.mockResolvedValue(page([detail()]))
  api.getManagedSeries.mockResolvedValue(detail())
  api.pageSeriesCandidates.mockResolvedValue(page([chapter(1), chapter(2), chapter(3, false)]))
  api.getArticleSeries.mockResolvedValue([])
  api.createSeries.mockImplementation(async body => detail({ ...body, revision: 1, articles: body.articleIds.map(id => chapter(id)) }))
  api.updateSeries.mockImplementation(async (_id, body) => detail({ ...body, revision: body.revision + 1, articles: body.articleIds.map(id => chapter(id)) }))
  api.deleteSeries.mockResolvedValue(null)
  ElMessageBox.confirm.mockResolvedValue('confirm')
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

it('公开目录严格使用服务端返回章节与计数，标题简介只作文本且空系列仍可阅读', async () => {
  api.getSeries.mockResolvedValue(detail({ title: '<img src=x onerror=alert(1)>', description: '<script>bad()</script>', articles: [chapter(2)], articleCount: 1 }))
  await open('/series/learning')
  expect(wrapper.findAll('.chapter-list li')).toHaveLength(1)
  expect(wrapper.get('.chapter-list a').attributes('href')).toBe('/article/chapter-2')
  expect(wrapper.text()).toContain('1 篇公开文章')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('script').exists()).toBe(false)
  api.getSeries.mockResolvedValueOnce(detail({ articles: [], articleCount: 0 }))
  await router.push('/series/empty'); await flushPromises()
  expect(wrapper.text()).toContain('暂无可公开阅读的章节')
})

it('公开详情切换后忽略旧响应，失败不残留旧标题和目录并允许重试', async () => {
  const old = deferred()
  api.getSeries.mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error('不存在'))
  await open('/series/old')
  await router.push('/series/missing'); await flushPromises()
  old.resolve(detail()); await flushPromises()
  expect(wrapper.find('.chapter-list').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('学习系列')
  expect(wrapper.get('[role="alert"]').text()).toContain('未公开')
  await button('重试加载').trigger('click'); await flushPromises()
  expect(wrapper.get('h1').text()).toBe('学习系列')
})

it('列表分页与浏览器返回恢复，管理员全部列表通过服务端参数控制', async () => {
  api.pageSeries.mockResolvedValue({ ...page([detail()]), total: 20 })
  await open('/series')
  await button('下一页').trigger('click'); await flushPromises()
  expect(api.pageSeries).toHaveBeenLastCalledWith({ page: 2, size: 12 })
  router.back(); await flushPromises()
  expect(api.pageSeries).toHaveBeenLastCalledWith({ page: 1, size: 12 })
  await router.push('/my/series'); await flushPromises()
  await wrapper.get('input[type=checkbox]').setValue(true); await flushPromises()
  expect(api.pageManagedSeries).toHaveBeenLastCalledWith({ page: 1, size: 12, all: true })
})

it('创建公开系列按选定顺序保存，阻止重复添加并跳转编辑地址', async () => {
  await open('/my/series/new')
  await field('系列标题').setValue('新系列')
  await field('系列地址').setValue('new-series')
  await field('系列状态').setValue('PUBLISHED')
  await wrapper.get('[aria-label="添加《章节1》"]').trigger('click')
  await wrapper.get('[aria-label="添加《章节3》"]').trigger('click')
  expect(wrapper.get('[aria-label="添加《章节1》"]').element.disabled).toBe(true)
  expect(wrapper.text()).toContain('不对访客展示')
  await wrapper.get('[aria-label="上移《章节3》"]').trigger('click')
  expect(wrapper.findAll('.selected-chapter').map(item => item.attributes('data-article-id'))).toEqual(['3', '1'])
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(api.createSeries).toHaveBeenCalledWith(expect.objectContaining({ title: '新系列', slug: 'new-series', status: 'PUBLISHED', articleIds: [3, 1] }))
  expect(router.currentRoute.value.path).toBe('/my/series/7')
})

it('编辑移出及隐藏系列带版本保存，候选始终按当前系列作者限定', async () => {
  await open('/my/series/7')
  expect(api.pageSeriesCandidates).toHaveBeenCalledWith({ seriesId: '7', keyword: '', page: 1, size: 10 })
  await wrapper.get('[aria-label="移出《章节1》"]').trigger('click')
  await field('系列状态').setValue('DRAFT')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(api.updateSeries).toHaveBeenCalledWith('7', expect.objectContaining({ revision: 4, status: 'DRAFT', articleIds: [2] }))
  expect(wrapper.text()).toContain('系列已保存')
  expect(wrapper.text()).not.toContain('查看公开系列')
})

it('版本冲突保留元数据和章节顺序，不自动重试；显式重新加载确认后更新版本', async () => {
  api.updateSeries.mockRejectedValueOnce(Object.assign(new Error('冲突'), { code: '40900' }))
  await open('/my/series/7')
  await field('系列标题').setValue('本地原稿')
  await wrapper.get('[aria-label="上移《章节2》"]').trigger('click')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(field('系列标题').element.value).toBe('本地原稿')
  expect(wrapper.findAll('.selected-chapter').map(item => item.attributes('data-article-id'))).toEqual(['2', '1'])
  expect(wrapper.get('[role="alert"]').text()).toContain('当前编辑已保留')
  expect(api.updateSeries).toHaveBeenCalledTimes(1)
  api.getManagedSeries.mockResolvedValueOnce(detail({ revision: 6, title: '服务器版本' }))
  await button('重新加载系列').trigger('click'); await flushPromises()
  expect(ElMessageBox.confirm).toHaveBeenCalled()
  expect(field('系列标题').element.value).toBe('服务器版本')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(api.updateSeries).toHaveBeenLastCalledWith('7', expect.objectContaining({ revision: 6 }))
})

it('未保存时取消离开保留原稿；保存成功后离开不再提示', async () => {
  await open('/my/series/7')
  await field('系列标题').setValue('本地标题')
  ElMessageBox.confirm.mockRejectedValueOnce(new Error('cancel'))
  await router.push('/series'); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/my/series/7')
  expect(field('系列标题').element.value).toBe('本地标题')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  ElMessageBox.confirm.mockClear()
  await router.push('/series'); await flushPromises()
  expect(ElMessageBox.confirm).not.toHaveBeenCalled()
})

it('删除带当前版本，冲突不跳转；成功只回系列列表', async () => {
  api.deleteSeries.mockRejectedValueOnce(Object.assign(new Error('冲突'), { code: 40900 }))
  await open('/my/series/7')
  await button('删除系列').trigger('click'); await flushPromises()
  expect(api.deleteSeries).toHaveBeenCalledWith('7', 4)
  expect(router.currentRoute.value.path).toBe('/my/series/7')
  expect(wrapper.text()).toContain('当前编辑已保留')
  await button('删除系列').trigger('click'); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/my/series')
})

it('拒绝保留地址，空章节系列可保存且失败保留表单', async () => {
  await open('/my/series/new')
  await field('系列标题').setValue('空系列')
  await field('系列地址').setValue('manage')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(api.createSeries).not.toHaveBeenCalled()
  await field('系列地址').setValue('empty')
  api.createSeries.mockRejectedValueOnce(new Error('暂时离线'))
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(api.createSeries).toHaveBeenCalledWith(expect.objectContaining({ articleIds: [] }))
  expect(field('系列标题').element.value).toBe('空系列')
  expect(wrapper.get('[role="alert"]').text()).toBe('暂时离线')
})

it('删除确认期间切换到另一系列，迟到确认不得删除新系列或原系列', async () => {
  const confirmation = deferred()
  await open('/my/series/7')
  ElMessageBox.confirm.mockReturnValueOnce(confirmation.promise)
  await button('删除系列').trigger('click')
  api.getManagedSeries.mockResolvedValueOnce(detail({ id: 8, title: '另一个系列', revision: 10 }))
  await router.push('/my/series/8'); await flushPromises()
  confirmation.resolve('confirm'); await flushPromises()
  expect(api.deleteSeries).not.toHaveBeenCalled()
  expect(field('系列标题').element.value).toBe('另一个系列')
})

it('候选查询旧响应不覆盖新词，重复保存单飞，保存中禁止离开', async () => {
  const old = deferred(), save = deferred()
  await open('/my/series/7')
  api.pageSeriesCandidates.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([chapter(4)]))
  await field('查找文章').setValue('旧词'); await button('查找').trigger('click')
  await field('查找文章').setValue('新词'); await button('查找').trigger('click'); await flushPromises()
  old.resolve(page([chapter(9)])); await flushPromises()
  expect(wrapper.findAll('.candidate').map(node => node.text()).join()).toContain('章节4')
  expect(wrapper.findAll('.candidate').map(node => node.text()).join()).not.toContain('章节9')
  api.updateSeries.mockReturnValueOnce(save.promise)
  await wrapper.get('form').trigger('submit'); await wrapper.get('form').trigger('submit')
  expect(api.updateSeries).toHaveBeenCalledTimes(1)
  await router.push('/series'); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/my/series/7')
  save.resolve(detail()); await flushPromises()
})

it('所属系列显示多条独立上下篇；切换文章清空旧导航，末篇不产生无效链接', async () => {
  api.getArticleSeries.mockResolvedValueOnce([{ id: 7, slug: 'learning', title: '系列一', articleCount: 2, previous: chapter(1), next: null }])
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div/>' } }] })
  await router.push('/article/2')
  wrapper = mount(ArticleSeriesNavigation, { props: { articleId: 2 }, global: { plugins: [router] } })
  await flushPromises()
  expect(wrapper.text()).toContain('上一篇：章节1')
  expect(wrapper.text()).toContain('已是最后一篇')
  expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['/series/learning', '/article/chapter-1'])
  const pending = deferred()
  api.getArticleSeries.mockReturnValueOnce(pending.promise)
  await wrapper.setProps({ articleId: 3 })
  expect(wrapper.find('a').exists()).toBe(false)
  wrapper.unmount()
  pending.resolve([{ id: 8, title: '迟到', slug: 'late' }]); await flushPromises()
  expect(wrapper.html()).not.toContain('迟到')
})
