import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import ArticleDetailView from '../ArticleDetailView.vue'
import { getArticle, getArticleBySlug, verifyArticlePassword } from '../../api/article'

const params = reactive({ id: '7', slug: undefined })
vi.mock('vue-router', () => ({ useRoute: () => ({ params }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../api/article', () => ({ getArticle: vi.fn(), getArticleBySlug: vi.fn(), verifyArticlePassword: vi.fn(), exportArticle: vi.fn() }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ user: null, isLoggedIn: false }) }))
vi.mock('../../composables/useDocumentTitle', () => ({ useDocumentTitle: () => ({ setTitle: vi.fn() }) }))
vi.mock('md-editor-v3', () => ({ MdCatalog: { template: '<div />' } }))
vi.mock('../../components/MdContentPreview.vue', () => ({ default: { props: ['content'], template: '<div class="body">{{ content }}</div>' } }))
vi.mock('../../components/CommentSection.vue', () => ({ default: { template: '<div class="comments" />' } }))
vi.mock('../../components/CaptchaInput.vue', () => ({ default: { props: ['scene'], template: '<div class="captcha">{{ scene }}</div>' } }))
vi.mock('../../components/ArticleSeriesNavigation.vue', () => ({ default: { props: ['articleId'], template: '<div class="series-navigation">系列 {{ articleId }}</div>' } }))

const gate = { id: 7, slug: 'secret-post', visibility: 'PASSWORD', passwordRequired: true }
const unlocked = { ...gate, passwordRequired: false, title: '受保护标题', content: '受保护正文', editorType: 'MARKDOWN' }
const mountView = () => mount(ArticleDetailView, { global: { plugins: [ElementPlus] } })

describe('文章密码门禁', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params.id = '7'
    params.slug = undefined
    getArticle.mockResolvedValue(gate)
    getArticleBySlug.mockResolvedValue(gate)
  })

  it('门禁不渲染正文、评论、导出；通过口令后带令牌重新取详情', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('需要访问口令')
    expect(wrapper.find('.body').exists()).toBe(false)
    expect(wrapper.find('.comments').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('导出')
    verifyArticlePassword.mockResolvedValue({ accessToken: 'grant', expiresIn: 7200 })
    getArticle.mockResolvedValue(unlocked)
    await wrapper.find('input').setValue('pwd-1234')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(verifyArticlePassword).toHaveBeenCalledWith(7, { password: 'pwd-1234', captchaId: '', captchaCode: '' })
    expect(getArticle).toHaveBeenLastCalledWith('7', 'grant')
    expect(wrapper.text()).toContain('受保护正文')
    expect(wrapper.find('.comments').exists()).toBe(false)
    wrapper.unmount()
  })

  it('错误口令保持门禁；达到限流阈值显示正确场景的验证码', async () => {
    const wrapper = mountView()
    await flushPromises()
    verifyArticlePassword.mockRejectedValue({ code: '40066' })
    await wrapper.find('input').setValue('wrong')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.captcha').text()).toBe('article-password')
    expect(wrapper.find('.body').exists()).toBe(false)
    wrapper.unmount()
  })

  it('slug 入口使用 slug 详情，切换文章清除令牌和旧正文', async () => {
    params.id = undefined
    params.slug = 'secret-post'
    const wrapper = mountView()
    await flushPromises()
    expect(getArticleBySlug).toHaveBeenCalledWith('secret-post', '')
    verifyArticlePassword.mockResolvedValue({ accessToken: 'grant' })
    getArticleBySlug.mockResolvedValueOnce(unlocked)
    await wrapper.find('input').setValue('pwd-1234')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    params.slug = 'another-post'
    await flushPromises()
    expect(getArticleBySlug).toHaveBeenLastCalledWith('another-post', '')
    expect(wrapper.text()).not.toContain('受保护正文')
    wrapper.unmount()
  })

  it('仅对当前公开可读文章挂载系列导航，作者可查看的未来或受限文章不挂载', async () => {
    getArticle.mockResolvedValue({ id: 7, title: '公开文章', editorType: 'MARKDOWN', visibility: 'PUBLIC', visible: true })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('.series-navigation').text()).toBe('系列 7')
    getArticle.mockResolvedValue({ id: 8, title: '尚未到点', editorType: 'MARKDOWN', visibility: 'PUBLIC', visible: false })
    params.id = '8'; await flushPromises()
    expect(wrapper.find('.series-navigation').exists()).toBe(false)
    wrapper.unmount()
  })
})
