import http from './http'

export function listSessionDevices() {
  return http.get('/auth/sessions', { silent: true })
}

export function revokeSessionDevices(id, proof) {
  return http.post(`/auth/sessions/${id ? encodeURIComponent(id) : 'others'}/revoke`, proof, { silent: true })
}
