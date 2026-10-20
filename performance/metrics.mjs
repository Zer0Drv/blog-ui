import { readFile } from 'node:fs/promises'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'
import { resolve, sep } from 'node:path'

const compressionCache = new Map()
// Install before navigation. No page content, credentials, or event targets are collected.
export function observeMetrics() {
  performance.setResourceTimingBufferSize(3000)
  const data = { lcpMs: null, cls: 0, longTaskMs: 0, events: [] }
  let windowStart = 0, lastShift = 0, windowScore = 0
  const observers = []
  function observe(type, consume, options = {}) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) throw new Error(`Unsupported metric: ${type}`)
    const observer = new PerformanceObserver(list => list.getEntries().forEach(consume))
    observer.observe({ type, buffered: true, ...options })
    observers.push({ observer, consume })
  }
  observe('largest-contentful-paint', entry => { data.lcpMs = entry.startTime })
  observe('layout-shift', entry => {
    if (entry.hadRecentInput) return
    if (entry.startTime - lastShift >= 1000 || entry.startTime - windowStart >= 5000) {
      windowStart = entry.startTime; windowScore = 0
    }
    windowScore += entry.value; lastShift = entry.startTime
    data.cls = Math.max(data.cls, windowScore)
  })
  observe('longtask', entry => { data.longTaskMs += entry.duration })
  observe('event', entry => {
    if (entry.interactionId) data.events.push({ id: entry.interactionId, duration: entry.duration })
  }, { durationThreshold: 16 })
  window.__performanceSnapshot = () => {
    for (const { observer, consume } of observers) observer.takeRecords().forEach(consume)
    return { ...data, fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      resources: performance.getEntriesByType('resource').map(entry => ({
        path: new URL(entry.name).pathname, sameOrigin: new URL(entry.name).origin === location.origin,
        type: entry.initiatorType, durationMs: entry.duration,
        transferBytes: entry.transferSize, encodedBodyBytes: entry.encodedBodySize
      })) }
  }
}

export function interactionSummary(events) {
  const interactions = new Map()
  for (const { id, duration } of events) interactions.set(id, Math.max(interactions.get(id) ?? 0, duration))
  // Deliberately not called field INP: this covers only the scripted interactions and
  // Event Timing omits durations below its 16 ms minimum reporting threshold.
  return { observedInteractions: interactions.size,
    labInteractionMaxMs: interactions.size ? Math.max(...interactions.values()) : null }
}

export async function assetSizes(resources, directory = 'dist') {
  const root = resolve(directory)
  const sizes = []
  for (const path of [...new Set(resources.filter(r => r.sameOrigin && /\.(js|css)$/.test(r.path)).map(r => r.path))].sort()) {
    const file = resolve(root, '.' + decodeURIComponent(path))
    if (!file.startsWith(root + sep)) throw new Error('Asset outside dist')
    const bytes = await readFile(file)
    let cached = compressionCache.get(file)
    if (!cached || !cached.bytes.equals(bytes)) {
      cached = { bytes, sizes: { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length,
        brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length } }
      compressionCache.set(file, cached)
    }
    sizes.push({ path, kind: path.endsWith('.js') ? 'js' : 'css', ...cached.sizes })
  }
  return sizes
}

export function median(values) {
  const sorted = values.filter(value => value !== null).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
