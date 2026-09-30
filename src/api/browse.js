import http from './http'

// 阅读侧公开接口：全文搜索 / 文章归档

// 全文搜索：GET /articles/search?keyword=&page=&size=
export function searchArticles(params) {
  return http.get('/articles/search', { params })
}

// 归档时间线：GET /articles/archives → [{month, count, articles:[{id,title,publishTime}]}]
export function getArchives() {
  return http.get('/articles/archives')
}
