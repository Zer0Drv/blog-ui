import http from './http'

export const pageSeries = params => http.get('/series', { params })
export const getSeries = slug => http.get(`/series/${encodeURIComponent(slug)}`)
export const getArticleSeries = id => http.get(`/series/by-article/${id}`)
export const pageManagedSeries = params => http.get('/series/manage', { params })
export const getManagedSeries = id => http.get(`/series/manage/${id}`)
export const createSeries = data => http.post('/series/manage', data)
export const updateSeries = (id, data) => http.put(`/series/manage/${id}`, data)
export const deleteSeries = (id, revision) => http.delete(`/series/manage/${id}`, { params: { revision } })
export const pageSeriesCandidates = params => http.get('/series/manage/candidates', { params })
