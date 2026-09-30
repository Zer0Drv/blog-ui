import http from './http'

// 附件库（登录即可，仅能操作自己的数据）
export function pageAttachments(params) {
  return http.get('/attachments', { params })
}

export function pageAttachmentGroups() {
  return http.get('/attachments/groups')
}

export function createAttachmentGroup(name) {
  return http.post('/attachments/groups', { name })
}

export function renameAttachmentGroup(id, name) {
  return http.put(`/attachments/groups/${id}`, { name })
}

export function deleteAttachmentGroup(id) {
  return http.delete(`/attachments/groups/${id}`)
}

// 移入分组；groupId 传 null 表示移出分组
export function moveAttachment(id, groupId) {
  return http.put(`/attachments/${id}`, { groupId })
}

export function deleteAttachment(id) {
  return http.delete(`/attachments/${id}`)
}
