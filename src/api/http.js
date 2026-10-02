import axios from 'axios'
import { ElMessage } from 'element-plus'

// 后端统一响应 R<T>{code,data,message}：code!=='200' 按业务错误 reject
// 认证已改为 HttpOnly Cookie（AUTH_TOKEN，#13）：withCredentials 让浏览器自动携带，
// 前端不再持有/拼接 token；X-Requested-With 供后端识别 XHR 请求（配合 CSRF 防护）
const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
})

// 读取 Blob 错误体为 JSON（FileReader 兼容浏览器与 jsdom，Blob.text 在 jsdom 缺失）
function readBlobAsJson(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)) } catch (e) { reject(e) }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

http.interceptors.response.use(
  resp => {
    // 文件下载（blob）：返回完整响应，调用方需读 Content-Disposition 解析文件名
    if (resp.config?.responseType === 'blob') return resp
    const body = resp.data
    if (body && typeof body === 'object' && 'code' in body) {
      // rawResponse：调用方需要完整 R 体（如读取 message 做敏感词审核提示）时跳过 data 剥离
      if (body.code === '200') return resp.config?.rawResponse ? body : body.data
      ElMessage.error(body.message || '请求失败')
      // 业务错误：后端 code 挂到 Error 上（如 CAPTCHA_REQUIRED 供页面判断）
      const e = new Error(body.message || '请求失败')
      e.code = body.code
      return Promise.reject(e)
    }
    return body
  },
  async err => {
    // 文件流（blob）错误体：后端统一错误也是 JSON，转出来读业务码/消息
    if (err.response?.data instanceof Blob) {
      try {
        err.response.data = await readBlobAsJson(err.response.data)
      } catch { /* 非 JSON 错误体，保持原样 */ }
    }
    if (err.response?.status === 401) {
      // Cookie 会话失效（过期/被踢）统一跳登录页；
      // /auth/me 用于登录态探测，401 属预期结果，不跳转、不提示
      const isSessionProbe = /\/auth\/me$/.test(err.config?.url || '')
      if (!isSessionProbe && location.pathname !== '/login') location.href = '/login'
    }
    if (err.response?.status !== 401 || !/\/auth\/me$/.test(err.config?.url || '')) {
      ElMessage.error(err.response?.data?.message || err.message || '网络错误')
    }
    // HTTP 层错误：同样透传后端 code（限流/参数错误等也走 HTTP 状态码时可用）
    err.code = err.response?.data?.code
    return Promise.reject(err)
  }
)

export default http
