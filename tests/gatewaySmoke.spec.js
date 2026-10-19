// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { smokeGateway } from '../.github/scripts/gateway-smoke.mjs'

const sha = '0123456789abcdef0123456789abcdef01234567'
const servers = []
const execute = promisify(execFile)
const script = fileURLToPath(new URL('../.github/scripts/gateway-smoke.mjs', import.meta.url))
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => {
    server.closeAllConnections()
    server.close(resolve)
  })))
})

async function gateway(change = () => {}) {
  const article = { id: 42, slug: 'hello-world', title: 'Hello', status: 'PUBLISHED',
    visibility: 'PUBLIC', visible: true, content: '# Hello' }
  const html = '<html><div id="app"></div><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></html>'
  const ok = data => JSON.stringify({ code: '200', data })
  const routes = {
    '/': [200, 'text/html', html],
    '/assets/app.js': [200, 'text/javascript', 'console.log("hello")'],
    '/assets/app.css': [200, 'text/css', 'body { margin: 0 }'],
    '/release.json': [200, 'application/json', JSON.stringify({ schemaVersion: 1, sha })],
    '/api/site/config': [200, 'application/json', ok({ 'site.name': 'Blog' })],
    '/api/articles?page=1&size=1': [200, 'application/json', ok({ records: [article] })],
    '/api/articles/slug/hello-world': [200, 'application/json', ok(article)],
    '/api/articles/42': [200, 'application/json', ok(article)],
    '/article/hello-world': [200, 'text/html', html],
    '/article/42': [200, 'text/html', html]
  }
  change(routes, article, ok)
  const requests = []
  const server = createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, cookie: request.headers.cookie })
    const [status, type, body, delay = 0] = routes[request.url] || [404, 'text/plain', 'missing']
    response.writeHead(status, { 'content-type': type, ...(status === 302 ? { location: '/' } : {}) })
    if (delay) setTimeout(() => response.end(body), delay).unref()
    else response.end(body)
  })
  servers.push(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}`, requests }
}

describe('gateway business smoke over actual HTTP', () => {
  it('reads assets, exact release, public APIs and the article route anonymously', async () => {
    const { url, requests } = await gateway()
    const report = await smokeGateway(url, { expectedSha: sha })
    expect(report.frontendSha).toBe(sha)
    expect(report.articleId).toBe('42')
    expect(report.checks).toHaveLength(8)
    expect(requests.every(request => request.method === 'GET' && !request.cookie)).toBe(true)
  })

  it('supports legacy ID links when the API has no slug', async () => {
    const { url, requests } = await gateway((routes, article, ok) => {
      article.slug = null
      routes['/api/articles?page=1&size=1'][2] = ok({ records: [article] })
    })
    await smokeGateway(url)
    expect(requests.map(request => request.path)).toContain('/article/42')
  })

  it.each([
    ['asset missing', routes => { routes['/assets/app.js'][0] = 404 }],
    ['asset falls back to HTML', routes => { routes['/assets/app.js'][1] = 'text/html' }],
    ['empty asset', routes => { routes['/assets/app.js'][2] = '' }],
    ['redirect', routes => { routes['/'][0] = 302 }],
    ['missing mount point', routes => { routes['/'][2] = '<html>wrong site</html>' }],
    ['external script', routes => { routes['/'][2] = routes['/'][2].replace('/assets/app.js', 'https://example.com/app.js') }],
    ['wrong release', routes => { routes['/release.json'][2] = JSON.stringify({ schemaVersion: 1, sha: 'f'.repeat(40) }) }],
    ['API business failure', routes => { routes['/api/site/config'][2] = '{"code":"500","data":{}}' }],
    ['API HTML fallback', routes => { routes['/api/site/config'][1] = 'text/html' }],
    ['API malformed JSON', routes => { routes['/api/site/config'][2] = '{' }],
    ['no public articles', (routes, article, ok) => { routes['/api/articles?page=1&size=1'][2] = ok({ records: [] }) }],
    ['private list entry', (routes, article, ok) => { routes['/api/articles?page=1&size=1'][2] = ok({ records: [{ ...article, visibility: 'PRIVATE' }] }) }],
    ['protected detail', (routes, article, ok) => { routes['/api/articles/slug/hello-world'][2] = ok({ ...article, passwordRequired: true }) }],
    ['wrong article', (routes, article, ok) => { routes['/api/articles/slug/hello-world'][2] = ok({ ...article, id: 99 }) }],
    ['missing article route', routes => { routes['/article/hello-world'][0] = 404 }]
  ])('rejects %s', async (_, change) => {
    const { url } = await gateway(change)
    await expect(smokeGateway(url, { expectedSha: sha })).rejects.toThrow()
  })

  it.each(['file:///tmp/', 'http://user:password@localhost/', 'http://localhost/subpath', 'http://localhost/?token=secret'])(
    'rejects invalid gateway origin %s', async url => {
      await expect(smokeGateway(url)).rejects.toThrow('origin')
    }
  )

  it('rejects an invalid expected SHA before sending requests', async () => {
    const { url, requests } = await gateway()
    await expect(smokeGateway(url, { expectedSha: 'main' })).rejects.toThrow('full frontend SHA')
    expect(requests).toHaveLength(0)
  })

  it('fails a stalled response within the configured deadline', async () => {
    const { url } = await gateway(routes => { routes['/api/site/config'][3] = 500 })
    await expect(smokeGateway(url, { timeout: 100 })).rejects.toThrow()
  })

  it('prints parseable evidence from the real CLI', async () => {
    const { url } = await gateway()
    const { stdout } = await execute(process.execPath, [script, url, sha])
    expect(JSON.parse(stdout).frontendSha).toBe(sha)
  })

  it('returns a failing exit code and JSON evidence from the real CLI', async () => {
    const { url } = await gateway()
    try {
      await execute(process.execPath, [script, url, 'f'.repeat(40)])
      throw new Error('CLI unexpectedly succeeded')
    } catch (error) {
      expect(error.code).toBe(1)
      expect(JSON.parse(error.stdout)).toMatchObject({ ok: false, error: 'Gateway frontend SHA mismatch' })
    }
  })
})

it('runs smoke after verified publishing on normal CD and retains failure evidence', async () => {
  const workflow = await readFile(new URL('../.github/workflows/cd.yml', import.meta.url), 'utf8')
  const publish = workflow.indexOf('- name: 校验并发布已通过 CI 的产物')
  const smoke = workflow.indexOf('- name: 实际网关业务冒烟')
  const evidence = workflow.indexOf('- name: 保存网关冒烟证据')
  expect(publish).toBeGreaterThan(0)
  expect(smoke).toBeGreaterThan(publish)
  expect(evidence).toBeGreaterThan(smoke)
  const step = workflow.slice(smoke, evidence)
  expect(step).toContain("if: needs.gate.outputs.rollback == 'false'")
  expect(step).toContain('"$GATEWAY_URL" "$RELEASE_SHA"')
  expect(step).not.toContain('continue-on-error')
  expect(workflow.slice(evidence)).toContain("if: always() && needs.gate.outputs.rollback == 'false'")
})
