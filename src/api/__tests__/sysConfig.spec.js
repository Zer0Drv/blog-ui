import { beforeEach, expect, it, vi } from 'vitest'
import http from '../http'
import { getSysConfig, updateSysConfig, resetSysConfig, getSysConfigAudit } from '../sysConfig'
vi.mock('../http', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
it('使用管理员配置端点，保留强类型请求体并编码重置键', () => {
  const values = { 'blog.upload-daily-limit': 7, 'blog.search.fulltext-enabled': false }
  getSysConfig(); updateSysConfig(values); resetSysConfig('blog.upload-daily-limit'); getSysConfigAudit({ page: 2, size: 20 })
  expect(http.get).toHaveBeenCalledWith('/admin/sys/config')
  expect(http.put).toHaveBeenCalledWith('/admin/sys/config', values)
  expect(http.delete).toHaveBeenCalledWith('/admin/sys/config/blog.upload-daily-limit')
  expect(http.get).toHaveBeenCalledWith('/admin/sys/config/audit', { params: { page: 2, size: 20 } })
})
