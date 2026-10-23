import { ref } from 'vue'
import { getSiteConfig } from '../api/site'

export const DEFAULT_SITE_NAME = 'Blog'
const siteName = ref(DEFAULT_SITE_NAME)
const siteDescription = ref('')
const siteIcp = ref('')
const friendLinksEnabled = ref(true)
const siteConfigReady = ref(false)
let loadPromise = null
let generation = 0

function apply(config = {}) {
  siteName.value = config['site.name'] || DEFAULT_SITE_NAME
  siteDescription.value = config['site.description'] || ''
  siteIcp.value = config['site.icp'] || ''
  friendLinksEnabled.value = config['site.friend_links_enabled'] !== 'false'
  siteConfigReady.value = true
  try { sessionStorage.setItem('site:config', JSON.stringify(config)) } catch { /* optional cache */ }
}

// Only committed values may be published; invalidate any older in-flight read.
export function publishSiteConfig(config) {
  generation++
  apply(config)
  loadPromise = Promise.resolve(true)
  try { localStorage.setItem('site:config:changed', Date.now() + ':' + Math.random()) } catch { /* focus revalidates */ }
}

export function ensureSiteConfig(force = false) {
  if (loadPromise && !force) return loadPromise
  const version = ++generation
  loadPromise = Promise.resolve().then(() => getSiteConfig()).then(config => {
    if (version === generation) apply(config)
    return version === generation
  }).catch(() => {
    if (version === generation) loadPromise = null
    return false
  })
  return loadPromise
}

// New documents always read the server; other tabs converge on save or focus.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === 'site:config:changed') void ensureSiteConfig(true)
  })
  window.addEventListener('focus', () => { void ensureSiteConfig(true) })
}

export function useSiteConfig() {
  return { siteName, siteDescription, siteIcp, friendLinksEnabled, siteConfigReady }
}
