import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import CommentSection from '../CommentSection.vue'
import { useAuthStore } from '../../stores/auth'
import { listComments, createComment } from '../../api/comment'
import { CAPTCHA_REQUIRED_CODE, getCaptcha } from '../../api/captcha'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))

vi.mock('../../api/comment', () => ({
  listComments: vi.fn(),
  listReplies: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn()
}))

vi.mock('../../api/interaction', () => ({
  likeComment: vi.fn(),
  unlikeComment: vi.fn()
}))

vi.mock('../../api/upload', () => ({ resolveUploadUrl: v => v }))

// 保留真实 CAPTCHA_REQUIRED_CODE 码值，仅 mock 取图接口
vi.mock('../../api/captcha', async importOriginal => {
  const mod = await importOriginal()
  return { ...mod, getCaptcha: vi.fn() }
})

function captchaError() {
  return Object.assign(new Error('操作过于频繁，请先完成验证'), { code: CAPTCHA_REQUIRED_CODE })
}

function mountSection() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.token = 'tok'
  auth.user = { id: 1, username: 'me', role: 'USER' }
  const wrapper = mount(CommentSection, {
    props: { articleId: 10 },
    global: { plugins: [pinia, ElementPlus] },
    attachTo: document.body
  })
  return { wrapper, auth }
}

describe('CommentSection 评论验证码链路（CAPTCHA_REQUIRED）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    listComments.mockResolvedValue({ records: [], total: 0 })
    getCaptcha.mockResolvedValue({ captchaId: 'cid-c', imageBase64: 'data:image/png;base64,AAA' })
  })

  it('初始不渲染验证码；发表评论返回 CAPTCHA_REQUIRED 码值后显示', async () => {
    const { wrapper } = mountSection()
    await flushPromises()
    createComment.mockRejectedValueOnce(captchaError())

    expect(wrapper.find('.captcha-input').exists()).toBe(false)

    await wrapper.find('.editor-row textarea').setValue('第一条评论')
    await wrapper.findAll('button').find(b => b.text() === '发表评论').trigger('click')
    await flushPromises()

    // 首次提交不带 captcha 字段（正常使用零打扰）
    expect(createComment).toHaveBeenCalledWith({ articleId: 10, content: '第一条评论' })
    expect(wrapper.find('.captcha-input').exists()).toBe(true)
    expect(getCaptcha).toHaveBeenCalledWith('comment')
    wrapper.unmount()
  })

  it('带验证码重发：请求体并入 captchaId/captchaCode，成功后隐藏清空并刷新列表', async () => {
    const { wrapper } = mountSection()
    await flushPromises()
    createComment.mockRejectedValueOnce(captchaError())

    await wrapper.find('.editor-row textarea').setValue('第一条评论')
    await wrapper.findAll('button').find(b => b.text() === '发表评论').trigger('click')
    await flushPromises()
    expect(wrapper.find('.captcha-input').exists()).toBe(true)

    listComments.mockClear()
    createComment.mockResolvedValueOnce({ code: '200', message: 'success', data: null })
    await wrapper.findAll('button').find(b => b.text() === '发表评论').trigger('click')
    await flushPromises()

    expect(createComment).toHaveBeenLastCalledWith({
      articleId: 10,
      content: '第一条评论',
      captchaId: 'cid-c',
      captchaCode: ''
    })
    // 成功后隐藏验证码并重新拉取评论列表
    expect(wrapper.find('.captcha-input').exists()).toBe(false)
    expect(listComments).toHaveBeenCalled()
    wrapper.unmount()
  })
})
