import { defineStore } from 'pinia'
import http from '../api/http'
import { useRealtimeStore } from './realtime'

// 登录态基于后端 HttpOnly Cookie（AUTH_TOKEN，#13）：前端不持有 token，
// 通过 GET /auth/me 探测（200=已登录，401=未登录）
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    // 会话探测是否已执行（路由守卫首次导航时经 /auth/me 恢复会话）
    sessionChecked: false
  }),
  getters: {
    isLoggedIn: s => !!s.user
  },
  actions: {
    async login(username, password) {
      // 后端校验通过后 Set-Cookie: AUTH_TOKEN（HttpOnly），响应体不再含 token
      await http.post('/auth/login', { username, password })
      await this.fetchMe()
    },
    async register(form) {
      await http.post('/auth/register', form)
      await this.fetchMe()
    },
    async sendEmailCode(email) {
      await http.post('/auth/email-code', { email })
    },
    // 密码找回：发码（SCENE_RESET）；邮箱未注册后端返回 EMAIL_NOT_REGISTERED
    async sendResetCode(email) {
      await http.post('/auth/password-reset-code', { email })
    },
    // 密码找回：验码成功后 BCrypt 更新密码；历史 token 不作废（后端 JWT 取舍）
    async resetPassword(form) {
      await http.post('/auth/password-reset', form)
    },
    // GitHub OAuth 回跳：一次性 code 换 Cookie 会话（POST /auth/oauth/exchange）
    async exchangeOAuthCode(code) {
      await http.post('/auth/oauth/exchange', { code })
      await this.fetchMe()
    },
    async fetchMe() {
      this.user = await http.get('/auth/me')
      // 已登录态恢复（刷新页面/OAuth 回跳等）成功后建立 WS（幂等）
      useRealtimeStore().connect()
    },
    // 应用启动/路由守卫首次导航时恢复会话；幂等，401 视为未登录
    async ensureSession() {
      if (this.sessionChecked) return
      this.sessionChecked = true
      try {
        await this.fetchMe()
      } catch {
        this.user = null
      }
    },
    async logout() {
      useRealtimeStore().disconnect()
      // 后端清 Cookie + 拉黑 token；后端报错（如 cookie 已失效）也允许本地登出
      try { await http.post('/auth/logout') } catch { /* 本地登出兜底 */ }
      this.user = null
      this.sessionChecked = true
    }
  }
})
