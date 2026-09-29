import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CaptchaInput from '../CaptchaInput.vue'
import { getCaptcha } from '../../api/captcha'

vi.mock('../../api/captcha', () => ({
  getCaptcha: vi.fn(),
  getCaptchaRequired: vi.fn(),
  CAPTCHA_REQUIRED_CODE: '40050'
}))

const IMG_A = 'data:image/png;base64,AAA'
const IMG_B = 'data:image/png;base64,BBB'

function mountCaptcha(props = {}) {
  return mount(CaptchaInput, {
    props: { scene: 'login', modelValue: { captchaId: '', captchaCode: '' }, ...props },
    global: { plugins: [ElementPlus] }
  })
}

describe('CaptchaInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCaptcha.mockResolvedValue({ captchaId: 'id-1', imageBase64: IMG_A })
  })

  it('挂载自动加载一次：渲染图片并 emit captchaId', async () => {
    const wrapper = mountCaptcha()
    await flushPromises()

    expect(getCaptcha).toHaveBeenCalledTimes(1)
    expect(getCaptcha).toHaveBeenCalledWith('login')
    const img = wrapper.find('img.captcha-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(IMG_A)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ captchaId: 'id-1', captchaCode: '' }])
  })

  it('输入框 placeholder 为「请输入图中字符」，输入经 v-model 透出', async () => {
    const wrapper = mountCaptcha({ modelValue: { captchaId: 'id-1', captchaCode: '' } })
    await flushPromises()

    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('请输入图中字符')
    await input.setValue('ab12')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ captchaId: 'id-1', captchaCode: 'ab12' }])
  })

  it('点击图片刷新：换新 captchaId 并清空输入', async () => {
    const wrapper = mountCaptcha()
    await flushPromises()

    getCaptcha.mockResolvedValue({ captchaId: 'id-2', imageBase64: IMG_B })
    await wrapper.find('img.captcha-img').trigger('click')
    await flushPromises()

    expect(getCaptcha).toHaveBeenCalledTimes(2)
    expect(wrapper.find('img.captcha-img').attributes('src')).toBe(IMG_B)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([{ captchaId: 'id-2', captchaCode: '' }])
  })

  it('scene 变化自动重新加载', async () => {
    const wrapper = mountCaptcha()
    await flushPromises()

    await wrapper.setProps({ scene: 'comment' })
    await flushPromises()

    expect(getCaptcha).toHaveBeenCalledTimes(2)
    expect(getCaptcha).toHaveBeenLastCalledWith('comment')
  })

  it('加载失败时不渲染图片（拦截器已提示）', async () => {
    getCaptcha.mockRejectedValue(new Error('网络错误'))
    const wrapper = mountCaptcha()
    await flushPromises()

    expect(wrapper.find('img.captcha-img').exists()).toBe(false)
    expect(wrapper.find('.captcha-placeholder').exists()).toBe(true)
  })
})
