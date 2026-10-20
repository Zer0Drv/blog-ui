import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MdContentPreview from '../MdContentPreview.vue'
import { sanitizeHtml } from '../../utils/sanitize'
vi.mock('../../lib/mdEditorConfig', () => ({}))

// stub MdPreview：本组件的契约是「sanitize 唯一挂载点 + get-catalog 透传」，
// 不测 md-editor-v3 自身渲染
vi.mock('md-editor-v3', () => ({
  MdPreview: {
    name: 'MdPreview',
    props: ['modelValue', 'editorId', 'sanitize'],
    emits: ['on-get-catalog'],
    template: '<div class="md-preview-stub" />'
  }
}))

function mountPreview(props = {}) {
  return mount(MdContentPreview, { props })
}

function findMdPreview(wrapper) {
  return wrapper.findComponent({ name: 'MdPreview' })
}

describe('MdContentPreview', () => {
  it('content/editorId 透传给 MdPreview', () => {
    const wrapper = mountPreview({ content: '# 标题', editorId: 'preview-1' })

    const md = findMdPreview(wrapper)
    expect(md.props('modelValue')).toBe('# 标题')
    expect(md.props('editorId')).toBe('preview-1')
  })

  it('sanitize 接线为统一 sanitizeHtml（#9 存储型 XSS 防护不可漏接）', () => {
    const wrapper = mountPreview({ content: '<img src=x onerror=alert(1)>' })

    const sanitize = findMdPreview(wrapper).props('sanitize')
    expect(sanitize).toBe(sanitizeHtml)
    // 行为断言：传入消毒函数确实剥除 on* 事件处理器
    expect(sanitize('<img src=x onerror=alert(1)>')).not.toContain('onerror')
  })

  it('MdPreview 的 on-get-catalog 以 get-catalog 原样透传', async () => {
    const wrapper = mountPreview({ content: '# a\n## b', editorId: 'preview-2' })
    const catalog = [{ text: 'a', level: 1 }, { text: 'b', level: 2 }]

    findMdPreview(wrapper).vm.$emit('on-get-catalog', catalog)
    await flushPromises()

    expect(wrapper.emitted('get-catalog')).toEqual([[catalog]])
  })

  it('默认 props：空内容与空 editorId 不报错', () => {
    const wrapper = mountPreview()
    const md = findMdPreview(wrapper)
    expect(md.props('modelValue')).toBe('')
    expect(md.props('editorId')).toBeUndefined()
  })
})
