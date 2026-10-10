import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

/**
 * 视图层读取当前登录用户的唯一入口（零样板，#22）。
 *
 * 契约：
 * - 仅可在路由守卫 resolve 之后使用（守卫已 await ensureSession()，会话状态就绪）；
 * - user === null 即未登录，不要再做「isLoggedIn && !user」之类的防御性判断；
 * - 禁止视图自行调用 auth.fetchMe() 补齐会话——会话恢复只发生在路由守卫 / login / OAuth 回跳。
 *
 * 返回值全部为 computed 转发自 auth store（hasRole/hasAnyRole 为函数型 getter 的转发）。
 */
export function useCurrentUser() {
  const auth = useAuthStore()

  if (import.meta.env.DEV && !auth.sessionChecked) {
    // 守卫 resolve 前即被调用（如组件在守卫外提前挂载）：会话未就绪，状态不可信
    console.warn(
      `[useCurrentUser] 会话尚未就绪（status=${auth.status}），` +
      '请确认在路由守卫 resolve 后使用；不要在视图层自行 fetchMe 补齐'
    )
  }

  return {
    user: computed(() => auth.user),
    isLoggedIn: computed(() => auth.isLoggedIn),
    isAdmin: computed(() => auth.isAdmin),
    canWrite: computed(() => auth.canWrite),
    hasRole: role => auth.hasRole(role),
    hasAnyRole: (...roles) => auth.hasAnyRole(...roles)
  }
}
