import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import View from '../admin/AdminAttachmentCleanup.vue'
import * as api from '../../api/attachmentCleanup'

vi.mock('../../api/attachmentCleanup', () => ({ pageAttachmentCleanup: vi.fn(), getAttachmentCleanupReport: vi.fn(), scanAttachmentObjects: vi.fn(), restoreAttachmentObject: vi.fn(), purgeAttachmentObject: vi.fn() }))
let wrapper, records
const button = id => wrapper.get(`[data-testid="${id}"]`)
async function open() { wrapper = mount(View, { global: { plugins: [ElementPlus] } }); await flushPromises() }
beforeEach(() => {
  vi.clearAllMocks()
  records = [{ id: 1, storage: 'LOCAL', objectKey: '202601/test.png', sizeBytes: 1024, state: 'OBSERVING', canPurge: false, eligibleAt: '2026-10-22T08:00:00Z', lastError: '' },
    { id: 2, storage: 'MINIO', objectKey: '202601/old.png', sizeBytes: 2048, state: 'OBSERVING', canPurge: true, eligibleAt: '2026-10-14T08:00:00Z', lastError: '' }]
  api.pageAttachmentCleanup.mockImplementation(async () => ({ records: structuredClone(records), total: 25 }))
  api.getAttachmentCleanupReport.mockResolvedValue({ reclaimedBytes: 4096, states: [{ state: 'OBSERVING', objectCount: 2, sizeBytes: 3072 }] })
  api.scanAttachmentObjects.mockResolvedValue({ scanned: 10, protected: 8, marked: 2 })
  api.restoreAttachmentObject.mockResolvedValue(null)
  api.purgeAttachmentObject.mockResolvedValue({ state: 'DELETED' })
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm')
  vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })

it('展示观察期、保护与回收统计，禁用未到期删除', async () => {
  await open()
  expect(wrapper.text()).toContain('7 天观察期')
  expect(wrapper.text()).toContain('4.0 KB')
  expect(wrapper.text()).toContain('观察中：2 个 / 3.0 KB')
  expect(button('purge-1').element.disabled).toBe(true)
  expect(button('purge-2').element.disabled).toBe(false)
  expect(api.pageAttachmentCleanup).toHaveBeenCalledWith({ page: 1, size: 20 })
})

it('扫描后刷新列表并展示受保护与新标记数量', async () => {
  await open(); await button('scan').trigger('click'); await flushPromises()
  expect(api.scanAttachmentObjects).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('本次扫描 10 个对象，保护 8 个，新增或重置观察期 2 个')
  expect(api.pageAttachmentCleanup).toHaveBeenCalledTimes(2)
})

it('恢复期间禁止重复操作，完成后刷新', async () => {
  let resolve
  api.restoreAttachmentObject.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  await open(); await button('restore-1').trigger('click')
  expect(button('scan').element.disabled).toBe(true)
  expect(button('purge-2').element.disabled).toBe(true)
  await button('restore-1').trigger('click')
  expect(api.restoreAttachmentObject).toHaveBeenCalledTimes(1)
  resolve(); await flushPromises()
  expect(ElMessage.success).toHaveBeenCalledWith('对象已恢复并保留')
})

it('取消物理删除不发送请求', async () => {
  ElMessageBox.confirm.mockRejectedValueOnce('cancel')
  await open(); await button('purge-2').trigger('click'); await flushPromises()
  expect(api.purgeAttachmentObject).not.toHaveBeenCalled()
})

it('服务端发现新引用时显示保留，不能误报删除成功', async () => {
  api.purgeAttachmentObject.mockResolvedValueOnce({ state: 'RETAINED' })
  await open(); await button('purge-2').trigger('click'); await flushPromises()
  expect(ElMessageBox.confirm).toHaveBeenCalledWith(expect.stringContaining('删除后无法恢复'), '物理删除附件', expect.any(Object))
  expect(api.purgeAttachmentObject).toHaveBeenCalledWith(2)
  expect(ElMessage.success).toHaveBeenCalledWith('发现引用，已保留对象')
})

it('操作失败后刷新不确定状态并保留错误提示', async () => {
  api.purgeAttachmentObject.mockRejectedValueOnce(new Error('存储连接失败'))
  await open(); await button('purge-2').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('存储连接失败')
  expect(api.pageAttachmentCleanup).toHaveBeenCalledTimes(2)
  expect(ElMessage.success).not.toHaveBeenCalled()
})

it('操作成功但刷新失败时显示准确结果并保留已有列表', async () => {
  await open()
  api.pageAttachmentCleanup.mockRejectedValueOnce(new Error('加载失败'))
  await button('scan').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('操作已完成，但列表刷新失败')
  expect(wrapper.text()).toContain('202601/old.png')
})

it('翻页请求失败时保留当前页和数据，能够重新加载', async () => {
  await open()
  api.pageAttachmentCleanup.mockRejectedValueOnce(new Error('分页失败'))
  await button('next').trigger('click'); await flushPromises()
  expect(api.pageAttachmentCleanup).toHaveBeenLastCalledWith({ page: 2, size: 20 })
  expect(wrapper.text()).toContain('第 1 页')
  expect(wrapper.text()).toContain('202601/old.png')
  await button('refresh').trigger('click'); await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

it('清理中对象提供重试，已删除对象没有恢复入口', async () => {
  records[0].state = 'PURGING'; records[0].canPurge = true; records[0].lastError = '删除未完成'
  records[1].state = 'DELETED'
  await open()
  expect(button('purge-1').text()).toBe('重试清理')
  expect(wrapper.text()).toContain('删除未完成')
  expect(wrapper.find('[data-testid="restore-2"]').exists()).toBe(false)
})

it('展示文件类型，只为仍存在的受管理图片提供预览和下载', async () => {
  records[0].objectKey = `202610/${'a'.repeat(32)}.png`
  records[1].objectKey = `202610/${'b'.repeat(32)}.svg`
  await open()
  const image = wrapper.get('[data-testid="object-1"]')
  const unsupported = wrapper.get('[data-testid="object-2"]')
  expect(image.text()).toContain('文件类型：PNG')
  expect(image.get('a').text()).toBe('下载原文件')
  expect(unsupported.text()).toContain('文件类型：SVG')
  expect(unsupported.text()).toContain('不支持此文件')
  expect(unsupported.find('img').exists()).toBe(false)
  expect(unsupported.find('a').exists()).toBe(false)
  records[0].state = 'MISSING'
  await button('refresh').trigger('click'); await flushPromises()
  expect(wrapper.get('[data-testid="object-1"]').text()).toContain('不可预览')
  expect(wrapper.get('[data-testid="object-1"]').find('a').exists()).toBe(false)
})
