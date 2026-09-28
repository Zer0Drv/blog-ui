import http from './http'

export function listTags() {
  return http.get('/tags')
}

export function createTag(name) {
  return http.post('/tags', { name })
}

export function updateTag(id, name) {
  return http.put(`/tags/${id}`, { name })
}

export function deleteTag(id) {
  return http.delete(`/tags/${id}`)
}
