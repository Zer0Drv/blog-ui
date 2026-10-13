import { ref } from 'vue'
import { getSiteConfig } from '../api/site'

// 站点名兜底：配置未拉到 / 拉取失败时标题与品牌名统一用它
export const DEFAULT_SITE_NAME = 'Blog'

// P0 站点配置（GET /site/config，白名单键 site.name / site.description / site.icp）
// 模块级共享 + sessionStorage 缓存：MainLayout、页签标题等共用一份，
// 全应用只拉一次（ensureSiteConfig 内部去重），失败静默保留默认
const siteName = ref(DEFAULT_SITE_NAME)
const siteDescription = ref('')
const siteIcp = ref('')
// P1 友链展示开关（site.friend_links_enabled，缺省视为开启，issue #17）
const friendLinksEnabled = ref(true)

let loadPromise = null

function applySiteConfig(config) {
  if (!config) return
  if (config['site.name']) siteName.value = config['site.name']
  siteDescription.value = config['site.description'] || ''
  siteIcp.value = config['site.icp'] || ''
  if ('site.friend_links_enabled' in config) {
    friendLinksEnabled.value = config['site.friend_links_enabled'] !== 'false'
  }
}

function readCache() {
  try {
    const cached = sessionStorage.getItem('site:config')
    if (cached) {
      applySiteConfig(JSON.parse(cached))
      return true
    }
  } catch { /* 缓存损坏则走接口 */ }
  return false
}

export function ensureSiteConfig() {
  if (loadPromise) return loadPromise
  if (readCache()) {
    loadPromise = Promise.resolve()
    return loadPromise
  }
  loadPromise = getSiteConfig()
    .then(data => {
      applySiteConfig(data)
      try {
        sessionStorage.setItem('site:config', JSON.stringify(data || {}))
      } catch { /* 存储失败静默 */ }
    })
    .catch(() => { /* 失败静默，保留默认 Blog */ })
  return loadPromise
}

export function useSiteConfig() {
  return { siteName, siteDescription, siteIcp, friendLinksEnabled }
}
