import http from './http'
export const getSubscription = () => http.get('/subscriptions/me')
export const setSubscription = enabled => http.put('/subscriptions/me', { enabled })
export const sendSubscriptionCode = () => http.post('/subscriptions/email-code')
export const confirmSubscriptionEmail = code => http.post('/subscriptions/email-confirm', { code })
export const stopSubscriptionEmail = () => http.delete('/subscriptions/email')
export const unsubscribe = token => http.post('/subscriptions/unsubscribe', { token })
export const getSubscriptionStats = () => http.get('/admin/subscriptions/stats')
