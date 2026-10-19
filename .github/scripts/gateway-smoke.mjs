import { pathToFileURL } from 'node:url'

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

// All traffic uses the public gateway, without cookies or mutation requests.
export async function smokeGateway(baseUrl, { expectedSha, timeout = 10000 } = {}) {
  const base = new URL(baseUrl)
  requireValue(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password &&
    base.pathname === '/' && !base.search && !base.hash, 'Expected a gateway HTTP(S) origin')
  requireValue(!expectedSha || /^[a-f0-9]{40}$/.test(expectedSha), 'Expected a full frontend SHA')
  requireValue(Number.isInteger(timeout) && timeout > 0, 'Expected a positive timeout')
  const checks = []

  async function read(path, type) {
    const url = new URL(path, base)
    requireValue(url.origin === base.origin, 'Resource must use the gateway origin')
    const response = await fetch(url, {
      redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(timeout)
    })
    requireValue(response.status === 200, `${url.pathname}: HTTP ${response.status}`)
    requireValue(type.test(response.headers.get('content-type') || ''), `${url.pathname}: unexpected content type`)
    const body = await response.text()
    requireValue(body.trim().length > 0, `${url.pathname}: empty response`)
    checks.push({ path: url.pathname, status: response.status })
    return body
  }

  async function api(path) {
    const result = JSON.parse(await read(path, /application\/json/i))
    requireValue(result.code === '200' && result.data != null, `${path}: unsuccessful API result`)
    return result.data
  }

  const html = await read('/', /text\/html/i)
  requireValue(/<div\b[^>]*\bid=["']app["']/i.test(html), 'Missing Vue mount point')
  const resources = new Map()
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const attributes = Object.fromEntries([...match[2].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)]
      .map(value => [value[1].toLowerCase(), value[3]]))
    if (match[1].toLowerCase() === 'script' && attributes.type === 'module' && attributes.src) {
      resources.set(attributes.src, /(?:javascript|ecmascript)/i)
    } else if (attributes.rel === 'stylesheet' && attributes.href) {
      resources.set(attributes.href, /text\/css/i)
    }
  }
  requireValue([...resources.values()].some(type => type.test('text/javascript')), 'Missing module entry script')
  for (const [path, type] of resources) await read(path, type)

  const release = JSON.parse(await read('/release.json', /application\/json/i))
  requireValue(release.schemaVersion === 1 && /^[a-f0-9]{40}$/.test(release.sha), 'Invalid release manifest')
  requireValue(!expectedSha || release.sha === expectedSha, 'Gateway frontend SHA mismatch')

  const config = await api('/api/site/config')
  requireValue(typeof config['site.name'] === 'string' && config['site.name'].trim(), 'Missing public site name')
  const articles = await api('/api/articles?page=1&size=1')
  requireValue(Array.isArray(articles.records) && articles.records.length > 0, 'No public article available for smoke check')
  const article = articles.records[0]
  requireValue(article.status === 'PUBLISHED' && article.visibility === 'PUBLIC' && article.visible === true,
    'Article list returned a non-public article')
  const id = String(article.id)
  requireValue(/^\d+$/.test(id), 'Invalid article ID')
  const slug = article.slug
  requireValue(!slug || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), 'Invalid article slug')
  const detail = await api(slug ? `/api/articles/slug/${slug}` : `/api/articles/${id}`)
  requireValue(String(detail.id) === id && detail.visibility === 'PUBLIC' && detail.status === 'PUBLISHED' &&
    detail.visible === true && detail.passwordRequired !== true && typeof detail.title === 'string' &&
    detail.title.trim() && typeof detail.content === 'string' && detail.content.trim(), 'Invalid public article detail')
  const page = await read(`/article/${slug || id}`, /text\/html/i)
  requireValue(/<div\b[^>]*\bid=["']app["']/i.test(page), 'Article route is missing the SPA shell')

  return { checkedAt: new Date().toISOString(), gateway: base.origin, frontendSha: release.sha,
    articleId: id, checks }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await smokeGateway(process.argv[2], { expectedSha: process.argv[3] })
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ checkedAt: new Date().toISOString(), ok: false,
      error: error.message }) + '\n')
    process.stderr.write(`Gateway smoke failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
