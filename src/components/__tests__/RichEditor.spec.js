import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RichEditor from '../RichEditor.vue'
import { uploadAndResolveUrl } from '../../api/upload'

// stub 掉 wangeditor 的 Editor/Toolbar：本组件的契约是「生命周期唯一主人 +
// v-model 透传 + customUpload 走 uploadAndResolveUrl」，不测 wangeditor 自身
vi.mock('@wangeditor/editor-for-vue', () => ({
  Editor: {
    name: 'Editor',
    props: ['modelValue', 'defaultConfig', 'mode'],
    emits: ['update:modelValue', 'on-created'],
    template: '<div class="editor-stub" />'
  },
  Toolbar: {
    name: 'Toolbar',
    props: ['editor', 'defaultConfig', 'mode'],
    template: '<div class="toolbar-stub" />'
  }
}))

vi.mock('../../api/upload', () => ({
  uploadAndResolveUrl: vi.fn()
}))

function mountEditor(props = {}) {
  return mount(RichEditor, { props })
}

function findEditor(wrapper) {
  return wrapper.findComponent({ name: 'Editor' })
}

describe('RichEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('v-model 透传：modelValue 下发给 Editor，Editor 回写时原样上抛', async () => {
    const wrapper = mountEditor({ modelValue: '<p>hello</p>' })

    expect(findEditor(wrapper).props('modelValue')).toBe('<p>hello</p>')

    findEditor(wrapper).vm.$emit('update:modelValue', '<p>world</p>')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['<p>world</p>'])
  })

  it('on-created 注入的实例归组件持有：Toolbar 收到同一实例', async () => {
    const wrapper = mountEditor()
    const fakeEditor = { destroy: vi.fn() }

    findEditor(wrapper).vm.$emit('on-created', fakeEditor)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Toolbar' }).props('editor')).toBe(fakeEditor)
  })

  it('unmount 时销毁编辑器实例（destroy 有且仅有一次）', async () => {
    const wrapper = mountEditor()
    const fakeEditor = { destroy: vi.fn() }
    findEditor(wrapper).vm.$emit('on-created', fakeEditor)
    await flushPromises()

    wrapper.unmount()
    expect(fakeEditor.destroy).toHaveBeenCalledTimes(1)
  })

  it('未创建实例即卸载不报错（destroy 不调用）', () => {
    const wrapper = mountEditor()
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('customUpload 经 uploadAndResolveUrl 上传并以展示 URL 插图', async () => {
    uploadAndResolveUrl.mockResolvedValue('/api/uploads/202401/a.png')
    const wrapper = mountEditor({ placeholder: '写点什么' })

    const config = findEditor(wrapper).props('defaultConfig')
    expect(config.placeholder).toBe('写点什么')

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const insertFn = vi.fn()
    await config.MENU_CONF.uploadImage.customUpload(file, insertFn)

    expect(uploadAndResolveUrl).toHaveBeenCalledWith(file)
    expect(insertFn).toHaveBeenCalledWith('/api/uploads/202401/a.png', 'a.png', '/api/uploads/202401/a.png')
  })

  it('customUpload 上传失败时不插图（拦截器已提示，静默兜底）', async () => {
    uploadAndResolveUrl.mockRejectedValue(new Error('网络错误'))
    const wrapper = mountEditor()

    const insertFn = vi.fn()
    const config = findEditor(wrapper).props('defaultConfig')
    await config.MENU_CONF.uploadImage.customUpload(new File(['x'], 'a.png'), insertFn)

    expect(insertFn).not.toHaveBeenCalled()
  })

  it('height prop 驱动 CSS 变量（默认 480px）', () => {
    expect(mountEditor().attributes('style')).toContain('--rt-editor-height: 480px')
    expect(mountEditor({ height: '600px' }).attributes('style')).toContain('--rt-editor-height: 600px')
  })
})
