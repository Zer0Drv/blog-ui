import http from './http'

export function listCategories() {
  return http.get('/categories')
}

export function createCategory(data) {
  return http.post('/categories', data)
}

export function updateCategory(id, data) {
  return http.put(`/categories/${id}`, data)
}

export function deleteCategory(id) {
  return http.delete(`/categories/${id}`)
}
