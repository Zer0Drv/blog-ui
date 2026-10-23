import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ObjectPreview from '../ObjectPreview.vue'

it('rejects executable URLs and provides missing-image placeholder', () => {
  for (const src of ['', 'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
    const wrapper = mount(ObjectPreview, { props: { src }, global: { plugins: [ElementPlus] } })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('暂无预览')
    wrapper.unmount()
  }
})

it('uses safe new window attributes and exposes file download', () => {
  const wrapper = mount(ObjectPreview, { props: { src: '/api/admin/attachments/cleanup/1/preview', original: '/api/admin/attachments/cleanup/1/preview?download=true', download: true }, global: { plugins: [ElementPlus] } })
  expect(wrapper.find('a').attributes('rel')).toBe('noopener noreferrer')
  expect(wrapper.find('a').text()).toBe('下载原文件')
  expect(wrapper.find('a').attributes('href')).toContain('?download=true')
  wrapper.unmount()
})
