import axios from 'axios'
import { ElMessage } from 'element-plus'

// 后端统一响应 R<T>{code,data,message}：code!=='200' 按业务错误 reject
const http = axios.create({ baseURL: '/api', timeout: 15000 })

http.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  resp => {
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
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      if (location.pathname !== '/login') location.href = '/login'
    }
    ElMessage.error(err.response?.data?.message || err.message || '网络错误')
    // HTTP 层错误：同样透传后端 code（限流/参数错误等也走 HTTP 状态码时可用）
    err.code = err.response?.data?.code
    return Promise.reject(err)
  }
)

export default http
