import http from './http'

const base = '/admin/attachments/cleanup'
export const pageAttachmentCleanup = params => http.get(base, { params })
export const getAttachmentCleanupReport = () => http.get(`${base}/report`)
export const scanAttachmentObjects = () => http.post(`${base}/scan`, null, { timeout: 120000 })
export const restoreAttachmentObject = id => http.post(`${base}/${id}/restore`)
export const purgeAttachmentObject = id => http.delete(`${base}/${id}`, { timeout: 120000 })
