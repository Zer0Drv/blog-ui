import { defineStore } from 'pinia'
import http from '../api/http'
import { useRealtimeStore } from './realtime'
import { ROLES, ROLE_GROUPS } from '../constants/roles'

// 触发图形验证码的后端业务码（单一来源在 api/captcha.js，此处再导出方便视图从 store 一处拿全登录契约）
export { CAPTCHA_REQUIRED_CODE } from '../api/captcha'

// 登录态基于后端 HttpOnly Cookie（AUTH_TOKEN，#13）：前端不持有 token，
// 通过 GET /auth/me 探测（200=已登录，401=未登录）
//
// 会话生命周期收口（#22）：
// - status 是唯一会话状态机：anonymous → pending → authenticated / expired
// - _applyUser 是唯一会话迁移点：null→user 建 WS，user→null 断 WS
// - fetchMe 降为纯取数（无任何副作用），login/logout/expireSession/ensureSession 全部经 _applyUser
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    // 会话状态机：anonymous（初始/未登录/登出）→ pending（探测中）→ authenticated（已登录）/ expired（会话失效）
    status: 'anonymous',
    // 会话探测是否已执行（路由守卫首次导航时经 /auth/me 恢复会话）
    sessionChecked: false
  }),
  getters: {
    isLoggedIn: s => !!s.user,
    isAdmin: s => s.user?.role === ROLES.ADMIN,
    // 写作者组（ADMIN/AUTHOR）：写文章、我的文章等入口共用
    canWrite: s => ROLE_GROUPS.WRITERS.includes(s.user?.role),
    hasRole: s => role => s.user?.role === role,
    hasAnyRole: s => (...roles) => roles.includes(s.user?.role)
  },
  actions: {
    // 私有接缝：唯一会话迁移点。null→user 触发 realtime.connect()，
    // user→null 触发 realtime.disconnect()；user→user / null→null 无动作（幂等）
    _applyUser(user, statusWhenNull = 'anonymous') {
      const prev = this.user
      this.user = user
      this.status = user ? 'authenticated' : statusWhenNull
      const realtime = useRealtimeStore()
      if (!prev && user) realtime.connect()
      else if (prev && !user) realtime.disconnect()
    },
    // /auth/login 唯一调用方；form 透传验证码字段 {username, password, captchaId?, captchaCode?}
    // 触发验证码时 reject 且 err.code === CAPTCHA_REQUIRED_CODE（由 http 拦截器透传）
    async login({ username, password, captchaId, captchaCode }) {
      const payload = { username, password }
      if (captchaId) {
        payload.captchaId = captchaId
        payload.captchaCode = captchaCode
      }
      // 后端校验通过后 Set-Cookie: AUTH_TOKEN（HttpOnly），响应体不再含 token
      await http.post('/auth/login', payload)
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
    // 纯取数：GET /auth/me 并迁移会话（去副作用——WS 建连由 _applyUser 迁移时触发）
    async fetchMe() {
      this._applyUser(await http.get('/auth/me'))
    },
    // 应用启动/路由守卫首次导航时恢复会话；幂等，401 视为未登录
    async ensureSession() {
      if (this.sessionChecked) return
      this.sessionChecked = true
      this.status = 'pending'
      try {
        await this.fetchMe()
      } catch {
        this._applyUser(null)
      }
    },
    // Cookie 会话失效（401 出口回调）：断 WS、置 expired，由装配层负责跳登录页
    expireSession() {
      this._applyUser(null, 'expired')
      this.sessionChecked = true
    },
    async logout() {
      // 后端清 Cookie + 拉黑 token；后端报错（如 cookie 已失效）也允许本地登出
      try { await http.post('/auth/logout') } catch { /* 本地登出兜底 */ }
      this._applyUser(null)
      this.sessionChecked = true
    }
  }
})
