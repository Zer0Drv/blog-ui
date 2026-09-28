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
