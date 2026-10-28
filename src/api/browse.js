import http from './http'

// 阅读侧公开接口：全文搜索 / 文章归档

// 搜索：keyword/categoryId/tagId/publishedFrom/publishedTo/sort/page/size。
// 日期为含首尾的 YYYY-MM-DD；响应额外包含 searchMode、effectiveSort 与纯文本 snippet。
export function searchArticles(params) {
  return http.get('/articles/search', { params })
}

// 归档时间线：GET /articles/archives → [{month, count, articles:[{id,title,publishTime}]}]
export function getArchives() {
  return http.get('/articles/archives')
}
