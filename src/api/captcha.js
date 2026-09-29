import http from './http'

// 后端 StatusCode.CAPTCHA_REQUIRED 的码值（触发限流后需先过图形验证码）
// 后端若调整码值，只改这一处；页面统一用 err.code === CAPTCHA_REQUIRED_CODE 判断
export const CAPTCHA_REQUIRED_CODE = '40066'

// GET /auth/captcha/required?scene= → { required: true|false }（按调用方 IP 判定）
export function getCaptchaRequired(scene) {
  return http.get('/auth/captcha/required', { params: { scene } })
}

// GET /auth/captcha?scene= → { captchaId, imageBase64 }
// 验证码存 Redis 5 分钟、一次性（校验一次即删），失败后需刷新换新图
export function getCaptcha(scene) {
  return http.get('/auth/captcha', { params: { scene } })
}
