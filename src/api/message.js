import http from './http'

// 私信接口（M4，v1 轮询）
// 会话列表：[{peer, lastMessage:{content,createTime,senderId}, unreadCount}]
export function listConversations() {
  return http.get('/messages/conversations')
}

// 与某人的消息分页（create_time 倒序，前端倒转展示）
export function pageMessages(peerId, page = 1, size = 20) {
  return http.get('/messages', { params: { peerId, page, size } })
}

// 发送私信：{receiverId, content}
export function sendMessage(receiverId, content) {
  return http.post('/messages', { receiverId, content })
}

// 把该会话中发给我的未读消息全部标记已读
export function markConversationRead(peerId) {
  return http.put('/messages/read', null, { params: { peerId } })
}
