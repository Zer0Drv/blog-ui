import http from './http'

export const getPage = slug => http.get(`/pages/${encodeURIComponent(slug)}`)
export const getPageNavigation = () => http.get('/site/page-navigation')
export const listAdminPages = params => http.get('/admin/pages', { params })
export const getAdminPage = id => http.get(`/admin/pages/${id}`)
export const createPage = data => http.post('/admin/pages', data)
export const updatePage = (id, data) => http.put(`/admin/pages/${id}`, data)
export const deletePage = id => http.delete(`/admin/pages/${id}`)

export function notifyPageNavigationChanged() {
  window.dispatchEvent(new Event('page-navigation-changed'))
}
