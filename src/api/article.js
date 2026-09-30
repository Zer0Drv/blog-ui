import http from './http'

// 公开接口
export function pageArticles(params) {
  return http.get('/articles', { params })
}

export function getArticle(id) {
  return http.get(`/articles/${id}`)
}

// 写作接口（ADMIN / AUTHOR）
export function createArticle(data) {
  return http.post('/articles', data)
}

export function updateArticle(id, data) {
  return http.put(`/articles/${id}`, data)
}

export function deleteArticle(id) {
  return http.delete(`/articles/${id}`)
}

export function updateArticleStatus(id, status) {
  return http.put(`/articles/${id}/status`, { status })
}

export function pageMyArticles(params) {
  return http.get('/articles/mine', { params })
}

// 自动保存（仅已有文章；正式保存成功后后端会自删）
export function autosaveArticle(id, data) {
  return http.put(`/articles/${id}/autosave`, data)
}

export function getAutosave(id) {
  return http.get(`/articles/${id}/autosave`)
}

// 版本历史
export function listArticleVersions(id) {
  return http.get(`/articles/${id}/versions`)
}

export function getArticleVersion(id, version) {
  return http.get(`/articles/${id}/versions/${version}`)
}

export function restoreArticleVersion(id, version) {
  return http.post(`/articles/${id}/restore/${version}`)
}

// 回收站
export function restoreArticle(id) {
  return http.post(`/articles/${id}/restore`)
}

export function forceDeleteArticle(id) {
  return http.delete(`/articles/${id}/force`)
}
