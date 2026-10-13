import http from './http'

// 公开友情链接（P1 issue #17）：GET /friend-links，仅返回启用状态，按排序升序
export function getFriendLinks() {
  return http.get('/friend-links')
}
