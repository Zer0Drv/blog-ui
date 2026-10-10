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

// 上传并返回可直接展示/插入的 URL（复用 resolveUploadUrl 补 /api 前缀）。
// 失败抛错，由调用方兜底（http 拦截器已统一提示）。
// 注意：需要把原始 /uploads/** 持久化到后端的场景（封面、附件库）应继续用
// uploadImage 拿 data.url，不要用本函数——持久化补过前缀的 URL 会被
// resolveUploadUrl 再次补前缀导致双重 /api。
export async function uploadAndResolveUrl(file) {
  const data = await uploadImage(file)
  return resolveUploadUrl(data.url)
}
