import http from './http'

// 通知接口（M4）：分页/未读数/已读
// type 可空：COMMENT_REPLY/MENTION/ARTICLE_LIKE/FOLLOW/PRIVATE_MESSAGE/SYSTEM
export function pageNotifications(type = '', page = 1, size = 10) {
  return http.get('/notifications', { params: { type: type || undefined, page, size } })
}

// 未读数：{count}
export function getUnreadCount() {
  return http.get('/notifications/unread-count')
}

export function markRead(id) {
  return http.put(`/notifications/${id}/read`)
}

export function markAllRead() {
  return http.put('/notifications/read-all')
}
