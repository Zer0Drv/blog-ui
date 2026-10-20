import { useSiteConfig } from '../composables/useSiteConfig'

// 复用后端匿名 HTML 的同一可见性与 canonical 策略，避免客户端另造分享规则。
let generation = 0
let pending
const selector = 'meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]'

export function resetArticleMetadata() {
  generation++
  pending?.abort()
  pending = null
  document.head.querySelectorAll(selector).forEach(node => node.remove())
  const { siteName, siteDescription } = useSiteConfig()
  for (const [attribute, key, value] of [
    ['name', 'description', siteDescription.value],
    ['property', 'og:title', siteName.value],
    ['property', 'og:description', siteDescription.value],
    ['property', 'og:type', 'website']
  ]) {
    const node = document.createElement('meta')
    node.setAttribute(attribute, key)
    node.content = value || ''
    document.head.append(node)
  }
}

export async function loadArticleMetadata(key) {
  resetArticleMetadata()
  const current = generation
  const controller = new AbortController()
  pending = controller
  const robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.append(robots)
  try {
    const response = await fetch(`/api/article/${encodeURIComponent(key)}`, {
      credentials: 'omit', cache: 'no-store', signal: controller.signal
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return
    const html = await response.text()
    if (current !== generation) return
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    document.head.querySelectorAll(selector).forEach(node => node.remove())
    for (const source of parsed.head.querySelectorAll(selector)) {
      const node = document.createElement(source.tagName.toLowerCase())
      if (source.tagName === 'LINK') {
        const href = source.getAttribute('href') || ''
        if (!/^https?:\/\//.test(href)) continue
        node.rel = 'canonical'
        node.href = href
      } else {
        const name = source.getAttribute('name')
        node.setAttribute(name ? 'name' : 'property', name || source.getAttribute('property'))
        node.setAttribute('content', source.getAttribute('content') || '')
      }
      document.head.append(node)
    }
  } catch { /* 旧后端 / 网络错误保留无文章信息的 head，不使用上篇文章的 metadata。 */ }
  finally { if (pending === controller) pending = null }
}
