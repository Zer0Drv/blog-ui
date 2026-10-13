import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import AdminSite from '../admin/AdminSite.vue'
import { getAdminSiteConfig, saveAdminSiteConfig } from '../../api/admin'
import { listAdminPages, notifyPageNavigationChanged } from '../../api/page'
vi.mock('../../api/admin', () => ({ getAdminSiteConfig: vi.fn(), saveAdminSiteConfig: vi.fn() }))
vi.mock('../../api/page', () => ({ listAdminPages: vi.fn(), notifyPageNavigationChanged: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
})
it('站点设置保留导航选择、调整顺序后保存 JSON，并通知前台刷新', async () => {
  getAdminSiteConfig.mockResolvedValue({ 'site.page_navigation': '["about","contact"]' })
  listAdminPages.mockResolvedValue({ records: [{ id: 1, slug: 'about', title: '关于', status: 'PUBLISHED' }, { id: 2, slug: 'contact', title: '联系', status: 'DRAFT' }] })
  saveAdminSiteConfig.mockImplementation(values => Promise.resolve(values))
  const wrapper = mount(AdminSite, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  expect(wrapper.findAll('.navigation-row').map(row => row.find('span').text())).toEqual(['关于', '联系'])
  await wrapper.findAll('.navigation-row')[0].findAll('button')[1].trigger('click')
  await wrapper.findAll('button').find(button => button.text() === '保存').trigger('click')
  await flushPromises()
  expect(saveAdminSiteConfig).toHaveBeenCalledWith(expect.objectContaining({ 'site.page_navigation': '["contact","about"]' }))
  expect(notifyPageNavigationChanged).toHaveBeenCalledOnce()
  wrapper.unmount()
})
