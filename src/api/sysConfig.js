import http from './http'

export const getSysConfig = () => http.get('/admin/sys/config')
export const updateSysConfig = values => http.put('/admin/sys/config', values)
export const resetSysConfig = key => http.delete(`/admin/sys/config/${encodeURIComponent(key)}`)
export const getSysConfigAudit = params => http.get('/admin/sys/config/audit', { params })
