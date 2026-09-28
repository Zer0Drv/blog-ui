import http from './http'

// POST /upload/image，multipart 字段名 file；返回 {url: "/uploads/yyyyMM/xxx.ext"}
export function uploadImage(file) {
  const form = new FormData()
  form.append('file', file)
  return http.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000
  })
}

// 后端返回的 url 是站点根路径 /uploads/**；开发环境 vite 只代理 /api，
// 因此展示/插入时统一补 /api 前缀（rewrite 会去掉前缀转发到后端 /uploads/**）
export function resolveUploadUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url
  return url.startsWith('/') ? `/api${url}` : url
}
