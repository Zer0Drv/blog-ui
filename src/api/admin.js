import http from './http'

// 管理后台接口（M5，全部 /admin 前缀，仅 ADMIN）

// ---- 用户管理 ----
export function pageAdminUsers(params) {
  return http.get('/admin/users', { params })
}

export function banUser(id) {
  return http.put(`/admin/users/${id}/ban`)
}

export function unbanUser(id) {
  return http.put(`/admin/users/${id}/unban`)
}

// role: 'AUTHOR' | 'USER'
export function updateUserRole(id, role) {
  return http.put(`/admin/users/${id}/role`, { role })
}

// ---- 文章管理 ----
export function pageAdminArticles(params) {
  return http.get('/admin/articles', { params })
}

export function setArticleTop(id, isTop) {
  return http.put(`/admin/articles/${id}/top`, { isTop })
}

export function setArticleRecommended(id, isRecommended) {
  return http.put(`/admin/articles/${id}/recommend`, { isRecommended })
}

export function offlineArticle(id) {
  return http.put(`/admin/articles/${id}/offline`)
}

// ---- 评论治理 ----
export function pageAdminComments(params) {
  return http.get('/admin/comments', { params })
}

export function foldComment(id) {
  return http.put(`/admin/comments/${id}/fold`)
}

export function unfoldComment(id) {
  return http.put(`/admin/comments/${id}/unfold`)
}

export function deleteAdminComment(id) {
  return http.delete(`/admin/comments/${id}`)
}

// P0 评论审核：仅 PENDING 状态可通过/拒绝
export function approveComment(id) {
  return http.put(`/admin/comments/${id}/approve`)
}

export function rejectComment(id) {
  return http.put(`/admin/comments/${id}/reject`)
}

// P0 评论回收站：恢复（deleted=1 → 正常）/ 彻底删除（物理删除）
export function restoreComment(id) {
  return http.post(`/admin/comments/${id}/restore`)
}

export function forceDeleteComment(id) {
  return http.delete(`/admin/comments/${id}/force`)
}

// ---- 敏感词库 ----
export function pageSensitiveWords(params) {
  return http.get('/admin/sensitive-words', { params })
}

export function addSensitiveWord(word) {
  return http.post('/admin/sensitive-words', { word })
}

export function deleteSensitiveWord(id) {
  return http.delete(`/admin/sensitive-words/${id}`)
}

// ---- 站点数据 ----
export function getStatsOverview() {
  return http.get('/admin/stats/overview')
}

export function getStatsRecent() {
  return http.get('/admin/stats/recent')
}

// ---- 站点设置（P0）----
export function getAdminSiteConfig() {
  return http.get('/admin/site/config')
}

// values 为 7 键 map：site.name/site.description/site.logo/site.icp/site.footer/site.base_url/comment.review_required
export function saveAdminSiteConfig(values) {
  return http.put('/admin/site/config', values)
}
