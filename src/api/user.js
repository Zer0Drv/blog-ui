import http from './http'

// PUT /users/me：更新当前用户资料（ProfileUpdateDTO：nickname 必填 ≤20，avatar ≤512，bio ≤255）
export function updateMyProfile(payload) {
  return http.put('/users/me', payload)
}

// 修改密码（ChangePasswordDTO：oldPassword/newPassword）
// 注：后端 AuthController 实际端点为 PUT /auth/password（SPEC 中的 /auth/change-password 为其语义描述）
export function changeMyPassword(payload) {
  return http.put('/auth/password', payload)
}

// P0 通知偏好：GET /users/me/preferences → { emailNotifyEnabled }
export function getMyPreferences() {
  return http.get('/users/me/preferences')
}

// P0 通知偏好：PUT /users/me/preferences，body { emailNotifyEnabled: boolean }
export function updateMyPreferences(payload) {
  return http.put('/users/me/preferences', payload)
}
