import http from './http'

// 社交接口（M4）：关注/用户主页/关注动态
export function follow(id) {
  return http.post(`/users/${id}/follow`)
}

export function unfollow(id) {
  return http.delete(`/users/${id}/follow`)
}

// 粉丝分页（FollowUserVO）
export function listFollowers(id, page = 1, size = 10) {
  return http.get(`/users/${id}/followers`, { params: { page, size } })
}

// 关注分页（FollowUserVO）
export function listFollowing(id, page = 1, size = 10) {
  return http.get(`/users/${id}/following`, { params: { page, size } })
}

// 用户公开信息：{id,username,nickname,avatar,bio,followerCount,followingCount,articleCount,followed}
export function getUserProfile(id) {
  return http.get(`/users/${id}/profile`)
}

// 用户已发布文章分页（ArticleListVO）
export function pageUserArticles(id, page = 1, size = 10) {
  return http.get(`/users/${id}/articles`, { params: { page, size } })
}

// 关注动态 Feed（ArticleListVO，publish_time 倒序）
export function pageFeed(page = 1, size = 10) {
  return http.get('/feed', { params: { page, size } })
}
