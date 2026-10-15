import { beforeEach, expect, it, vi } from 'vitest'
import http from '../http'
import * as api from '../attachmentCleanup'
vi.mock('../http', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
it('使用管理员清理接口并为扫描和物理删除设置独立超时', () => {
  api.pageAttachmentCleanup({ page: 2, size: 20 }); api.getAttachmentCleanupReport(); api.scanAttachmentObjects(); api.restoreAttachmentObject(4); api.purgeAttachmentObject(4)
  expect(http.get).toHaveBeenCalledWith('/admin/attachments/cleanup', { params: { page: 2, size: 20 } })
  expect(http.get).toHaveBeenCalledWith('/admin/attachments/cleanup/report')
  expect(http.post).toHaveBeenCalledWith('/admin/attachments/cleanup/scan', null, { timeout: 120000 })
  expect(http.post).toHaveBeenCalledWith('/admin/attachments/cleanup/4/restore')
  expect(http.delete).toHaveBeenCalledWith('/admin/attachments/cleanup/4', { timeout: 120000 })
})
