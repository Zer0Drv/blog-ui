import http from './http'

// 公开接口
export function pageArticles(params) {
  return http.get('/articles', { params })
}

export function getArticle(id, accessToken) {
  return accessToken
    ? http.get(`/articles/${id}`, { headers: { 'X-Article-Access-Token': accessToken } })
    : http.get(`/articles/${id}`)
}

// 按 slug 取文章详情（公开；Zer0Drv/blog#14 固定链接，与 id 详情并存）
export function getArticleBySlug(slug, accessToken) {
  const url = `/articles/slug/${encodeURIComponent(slug)}`
  return accessToken
    ? http.get(url, { headers: { 'X-Article-Access-Token': accessToken } })
    : http.get(url)
}

export function verifyArticlePassword(id, data) {
  return http.post(`/articles/${id}/password`, data)
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

// 从 Content-Disposition 解析下载文件名（优先 RFC 5987 filename*，兼容 filename=）
function parseDispositionFilename(disposition) {
  if (!disposition) return ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star) {
    try { return decodeURIComponent(star[1].trim()) } catch { return star[1].trim() }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1].trim() : ''
}

// 触发浏览器下载 blob 响应；失败时 http 拦截器已把 blob 错误体转 JSON 并统一提示业务码
function downloadBlob(resp, fallbackFilename) {
  const filename = parseDispositionFilename(resp.headers?.['content-disposition']) || fallbackFilename
  const url = URL.createObjectURL(resp.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// 导出文章为 md/html 文件并触发浏览器下载
export async function exportArticle(id, format = 'md') {
  const resp = await http.get(`/articles/${id}/export`, {
    params: { format },
    responseType: 'blob'
  })
  downloadBlob(resp, `article-${id}.${format === 'html' ? 'html' : 'md'}`)
}

// 批量导出勾选文章打包 zip（ADMIN 全部 / AUTHOR 仅本人）；ids 逗号拼接由后端拆分
export async function exportArticlesZip(ids) {
  const resp = await http.get('/articles/export', {
    params: { ids: ids.join(',') },
    responseType: 'blob'
  })
  downloadBlob(resp, 'articles-export.zip')
}

// 导入 .md/.markdown/.txt/.html/.htm 单文件（≤2MB）或 .zip 批量（≤5MB）。
// 响应统一为 { imported: [{id, title, warnings, externalImages}], failed: [{name, message}] }；
// 单文件硬性失败（扩展名/大小/front matter 非法）仍走业务异常由拦截器提示
export function importArticle(file) {
  const form = new FormData()
  form.append('file', file)
  return http.post('/articles/import', form)
}
