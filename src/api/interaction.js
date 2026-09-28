import http from './http'

// 互动接口（M3）：文章点赞/收藏、评论点赞、我的收藏
export function likeArticle(id) {
  return http.post(`/articles/${id}/like`)
}

export function unlikeArticle(id) {
  return http.delete(`/articles/${id}/like`)
}

export function favoriteArticle(id) {
  return http.post(`/articles/${id}/favorite`)
}

export function unfavoriteArticle(id) {
  return http.delete(`/articles/${id}/favorite`)
}

export function likeComment(id) {
  return http.post(`/comments/${id}/like`)
}

export function unlikeComment(id) {
  return http.delete(`/comments/${id}/like`)
}

// 我的收藏文章分页（ArticleListVO）
export function pageMyFavorites(page = 1, size = 10) {
  return http.get('/articles/mine/favorites', { params: { page, size } })
}
