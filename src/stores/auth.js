import { defineStore } from 'pinia'
import http from '../api/http'

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
    async fetchMe() {
      this.user = await http.get('/auth/me')
    },
    async logout() {
      try { await http.post('/auth/logout') } catch { /* token 已失效也允许本地登出 */ }
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
    }
  }
})
