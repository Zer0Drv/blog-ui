import { defineStore } from 'pinia'
import http from '../api/http'
import { useRealtimeStore } from './realtime'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: null
  }),
  getters: {
    isLoggedIn: s => !!s.token
  },
  actions: {
    async login(username, password) {
      const data = await http.post('/auth/login', { username, password })
      this.token = data.access_token
      localStorage.setItem('token', this.token)
      await this.fetchMe()
    },
    async register(form) {
      const data = await http.post('/auth/register', form)
      this.token = data.access_token
      localStorage.setItem('token', this.token)
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
    // OAuth 回调直接写入已签发的 token（GitHub 登录回跳 /oauth/callback?token=...）
    setToken(token) {
      this.token = token
      localStorage.setItem('token', token)
    },
    async fetchMe() {
      this.user = await http.get('/auth/me')
      // 已登录态恢复（刷新页面/OAuth 回跳等）成功后建立 WS（幂等）
      useRealtimeStore().connect()
    },
    async logout() {
      useRealtimeStore().disconnect()
      try { await http.post('/auth/logout') } catch { /* token 已失效也允许本地登出 */ }
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
    }
  }
})
