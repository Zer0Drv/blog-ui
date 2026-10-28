import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SearchView from '../SearchView.vue'
import { searchArticles } from '../../api/browse'
import { listCategories } from '../../api/category'
import { listTags } from '../../api/tag'

vi.mock('../../api/browse', () => ({ searchArticles: vi.fn() }))
vi.mock('../../api/category', () => ({ listCategories: vi.fn() }))
vi.mock('../../api/tag', () => ({ listTags: vi.fn() }))
vi.mock('../../api/upload', () => ({ resolveUploadUrl: value => value }))

let wrapper, router
const article = (id, title = `文章 ${id}`, snippet = '正文片段') => ({ id, slug: `post-${id}`, title, snippet, summary: '旧摘要', tags: [] })
const response = (records = [], extra = {}) => ({ records, total: records.length, searchMode: 'FULLTEXT', effectiveSort: 'relevance', ...extra })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const button = text => wrapper.findAll('button').find(b => b.text() === text)
async function open(query = {}) {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/search', component: SearchView }, { path: '/article/:id', component: { template: '<div />' } }] })
  await router.push({ path: '/search', query })
  await router.isReady()
  wrapper = mount(SearchView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}
async function submit(keyword) {
  await wrapper.get('#search-keyword').setValue(keyword)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  searchArticles.mockResolvedValue(response())
  listCategories.mockResolvedValue([{ id: 2, name: '编程', children: [{ id: 3, name: '数据库' }] }])
  listTags.mockResolvedValue([{ id: 4, name: 'Java' }])
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('SearchView 查询、导航和结果', () => {
  it('从分享 URL 恢复所有筛选和页码，分页使用已提交条件且支持前进后退', async () => {
    searchArticles.mockImplementation(async params => response([article(params.page)], { total: 21, effectiveSort: 'oldest' }))
    const query = { keyword: '数据库', categoryId: '3', tagId: '4', publishedFrom: '2026-01-01', publishedTo: '2026-10-28', sort: 'oldest', page: '2' }
    await open(query)
    expect(searchArticles).toHaveBeenLastCalledWith({ ...query, page: 2, size: 10 })
    for (const [id, value] of Object.entries({ keyword: '数据库', category: '3', tag: '4', from: '2026-01-01', to: '2026-10-28', sort: 'oldest' })) {
      expect(wrapper.get(`#search-${id}`).element.value).toBe(value)
    }
    expect(wrapper.text()).toContain('第 2 页 / 共 3 页')
    await wrapper.get('#search-keyword').setValue('尚未提交')
    await button('下一页').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ ...query, page: '3' })
    expect(searchArticles).toHaveBeenLastCalledWith({ ...query, page: 3, size: 10 })
    expect(button('下一页').element.disabled).toBe(true)
    router.back(); await flushPromises()
    expect(router.currentRoute.value.query).toEqual(query)
    expect(wrapper.get('#search-keyword').element.value).toBe('数据库')
    expect(wrapper.get('.article-card').text()).toContain('文章 2')
    router.forward(); await flushPromises()
    expect(wrapper.text()).toContain('第 3 页 / 共 3 页')
  })

  it('组合筛选提交重置页码并新增历史，清空条件恢复完整公开结果', async () => {
    await open({ keyword: '旧词', page: '3' })
    await wrapper.get('#search-category').setValue('2')
    await wrapper.get('#search-tag').setValue('4')
    await wrapper.get('#search-from').setValue('2026-10-01')
    await wrapper.get('#search-to').setValue('2026-10-28')
    await wrapper.get('#search-sort').setValue('newest')
    await submit(' 新词 ')
    expect(router.currentRoute.value.query).toEqual({ keyword: '新词', categoryId: '2', tagId: '4', publishedFrom: '2026-10-01', publishedTo: '2026-10-28', sort: 'newest' })
    expect(searchArticles).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, keyword: '新词', categoryId: '2', tagId: '4' }))
    await button('清空条件').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(searchArticles).toHaveBeenLastCalledWith({ keyword: '', sort: 'relevance', page: 1, size: 10 })
    expect(wrapper.get('#search-category').element.value).toBe('')
    router.back(); await flushPromises()
    expect(wrapper.get('#search-keyword').element.value).toBe('新词')
    expect(wrapper.get('#search-from').element.value).toBe('2026-10-01')
  })

  it('中文、短词与正则特殊字符按纯文本高亮，文章和关键词 HTML 不执行', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const text = '<img src=x onerror=alert(1)> 中文 a+b [x] C++ A'
    searchArticles.mockResolvedValue(response([article(1, text, text)], { searchMode: 'LIKE', effectiveSort: 'newest' }))
    await open({ keyword: '中文 a+b [x] C++ A' })
    expect(wrapper.get('.title').text()).toBe(text)
    expect(wrapper.get('.summary').text()).toBe(text)
    expect(wrapper.get('.summary').findAll('mark').map(m => m.text())).toEqual(['a', '中文', 'a+b', '[x]', 'C++', 'A'])
    expect(wrapper.find('.summary img').exists()).toBe(false)
    expect(alert).not.toHaveBeenCalled()
    expect(wrapper.find('.title img').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('.sort-notice').text()).toContain('无法计算相关度；结果按最新发布排序')
    expect(wrapper.get('.title a').attributes('href')).toBe('/article/post-1')
    await submit('<img src=x onerror=alert(1)>')
    expect(wrapper.get('.summary').text()).toBe(text)
    expect(wrapper.find('.summary img').exists()).toBe(false)
  })

  it('空结果提供调整关键词和清空条件入口，不将加载失败伪装为空结果', async () => {
    await open({ keyword: '不存在' })
    expect(wrapper.get('.empty-state').text()).toContain('没有找到相关文章')
    await button('调整关键词').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#search-keyword').element)
    searchArticles.mockResolvedValueOnce(response([article(1)]))
    await submit('成功')
    expect(wrapper.find('.article-card').exists()).toBe(true)
    searchArticles.mockRejectedValueOnce(new Error('offline'))
    await submit('失败')
    expect(wrapper.find('.article-card').exists()).toBe(false)
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    expect(wrapper.find('.result-tip').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('搜索失败')
    searchArticles.mockResolvedValueOnce(response([article(2)]))
    await button('重试搜索').trigger('click'); await flushPromises()
    expect(searchArticles).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '失败' }))
    expect(wrapper.get('.article-card').text()).toContain('文章 2')
  })

  it('旧请求完成或失败不能覆盖新查询、加载状态、计数和排序提示', async () => {
    const old = deferred(), current = deferred(), last = deferred()
    searchArticles.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise).mockReturnValueOnce(last.promise)
    await open({ keyword: '旧词' })
    await submit('新词')
    old.resolve(response([article(1, '旧结果')], { total: 99, searchMode: 'LIKE', effectiveSort: 'newest' }))
    await flushPromises()
    expect(wrapper.get('.results').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.article-card').exists()).toBe(false)
    await submit('最终词')
    last.resolve(response([article(3, '最终结果')], { total: 1 }))
    await flushPromises()
    current.reject(new Error('late error'))
    await flushPromises()
    expect(wrapper.get('.article-card').text()).toContain('最终结果')
    expect(wrapper.get('.result-tip').text()).toContain('共找到 1 篇')
    expect(wrapper.get('.sort-notice').text()).toBe('按相关度排序。')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('离开页面后忽略尚未完成的搜索与选项响应', async () => {
    const pending = deferred(), options = deferred()
    searchArticles.mockReturnValueOnce(pending.promise)
    listTags.mockReturnValueOnce(options.promise)
    await open({ keyword: '后台请求' })
    const state = wrapper.vm.$.setupState
    wrapper.unmount()
    pending.resolve(response([article(1)])); options.resolve([{ id: 5, name: '迟到' }])
    await flushPromises()
    expect(state.articles).toEqual([])
    expect(state.tags).toEqual([])
  })

  it.each([
    [{ publishedFrom: '2026-02-30' }, '请输入有效的发布日期'],
    [{ publishedFrom: '2026-10-28', publishedTo: '2026-10-01' }, '开始日期不能晚于结束日期'],
    [{ publishedTo: '9999-12-31' }, '请输入有效的发布日期'],
    [{ keyword: '长'.repeat(201) }, '关键词最多 200 个字符']
  ])('拒绝非法 URL 查询且清空后可恢复 %j', async (query, message) => {
    await open(query)
    expect(searchArticles).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain(message)
    await button('清空条件').trigger('click'); await flushPromises()
    expect(searchArticles).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('筛选选项失败不阻断搜索，允许重试且保留共享 URL 中的选中项', async () => {
    listTags.mockRejectedValueOnce(new Error('offline'))
    searchArticles.mockResolvedValue(response([article(1)]))
    await open({ tagId: '4' })
    expect(wrapper.get('#search-tag').element.value).toBe('4')
    expect(wrapper.get('.article-card').text()).toContain('文章 1')
    expect(wrapper.get('[role="alert"]').text()).toContain('分类或标签加载失败')
    await button('重试筛选选项').trigger('click'); await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('#search-tag').text()).toContain('Java')
    expect(searchArticles).toHaveBeenCalledTimes(1)
  })
})
