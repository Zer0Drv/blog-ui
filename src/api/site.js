import http from './http'

// 公开站点配置（P0）：GET /site/config，仅返回白名单键
// site.name / site.description / site.logo / site.icp / site.footer
export function getSiteConfig() {
  return http.get('/site/config')
}
