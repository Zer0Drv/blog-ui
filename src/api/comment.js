import http from './http'

// 评论接口（M3）
// 主评论分页：sort ∈ time_desc(默认)/time_asc/hot
export function listComments(articleId, sort = 'time_desc', page = 1, size = 10) {
  return http.get('/comments', { params: { articleId, sort, page, size } })
}

// 某主评论的回复分页（时间正序）
export function listReplies(rootId, page = 1, size = 10) {
  return http.get(`/comments/${rootId}/replies`, { params: { page, size } })
}

// 发表评论/回复：{articleId, content, parentId?, replyToUserId?}
export function createComment(data) {
  return http.post('/comments', data)
}

// 删除评论（本人或 ADMIN）
export function deleteComment(id) {
  return http.delete(`/comments/${id}`)
}
