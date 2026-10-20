import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, mkdtemp, appendFile, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { verifyManifest } from './release-manifest.mjs'
import { collectDeploymentEvidence } from './deployment-evidence.mjs'

const execute = promisify(execFile)
const repository = 'Zer0Drv/blog-ui'

export function requireCertifiedRun(run, jobs, sha) {
  if (run.head_sha !== sha || run.head_branch !== 'main' || run.conclusion !== 'success' ||
      run.path !== '.github/workflows/cd.yml' || !['push', 'workflow_dispatch'].includes(run.event)) {
    throw new Error('Rollback requires a successful main CD for the exact artifact commit')
  }
  for (const name of ['build', 'browser-e2e']) {
    if (!jobs.some(job => job.name === `ci / ${name}` && job.conclusion === 'success')) {
      throw new Error(`Historical CD has no successful required ${name} job`)
    }
  }
  if (jobs.some(job => !['success', 'skipped'].includes(job.conclusion))) {
    throw new Error('Historical CD has an incomplete or failed job')
  }
}

export function requireCompatible(matrix, frontendSha, backendSha, schema, checksum) {
  if (matrix.schemaVersion !== 1 || !matrix.cases.some(entry =>
    entry.frontendSha === frontendSha && entry.backendSha === backendSha && entry.schema === schema &&
    Number.isInteger(entry.schemaChecksum) && entry.schemaChecksum === checksum)) {
    throw new Error('This frontend/backend/schema combination has no reviewed compatibility evidence')
  }
}

export async function certifyRollback(dist, tag, matrixPath, gateway, {
  run = execute, evidence = collectDeploymentEvidence, fetcher = fetch
} = {}) {
  if (!/^sha-[a-f0-9]{8}$/.test(tag)) throw new Error('Invalid rollback tag')
  const candidate = JSON.parse(await readFile(join(dist, 'release.json'), 'utf8'))
  if (tag !== `sha-${candidate.sha?.slice(0, 8)}`) throw new Error('Archive tag/SHA mismatch')
  await verifyManifest(dist, candidate.sha)
  const runId = /^https:\/\/github\.com\/Zer0Drv\/blog-ui\/actions\/runs\/(\d+)$/.exec(candidate.runUrl)?.[1]
  if (!runId) throw new Error('Archive does not identify a trusted repository run')
  async function github(path) {
    const result = await run('gh', ['api', `repos/${repository}/${path}`],
      { timeout: 30000, maxBuffer: 2 * 1024 * 1024 })
    return JSON.parse(result.stdout)
  }
  const original = await github(`actions/runs/${runId}`)
  const jobPage = await github(`actions/runs/${runId}/jobs?per_page=100`)
  if (jobPage.total_count !== jobPage.jobs.length) throw new Error('Incomplete historical job inventory')
  requireCertifiedRun(original, jobPage.jobs, candidate.sha)
  // Trust the Actions artifact, not a self-consistent but modified MinIO manifest.
  const trusted = await mkdtemp(join(tmpdir(), 'blog-certified-release-'))
  try {
    await run('gh', ['run', 'download', runId, '--repo', repository,
      '--name', `frontend-dist-${candidate.sha}`, '--dir', trusted],
    { timeout: 120000, maxBuffer: 262144 })
    const originalManifest = await verifyManifest(trusted, candidate.sha)
    if (JSON.stringify(originalManifest) !== JSON.stringify(candidate)) {
      throw new Error('Archive differs from the original CI artifact')
    }
  } finally {
    if (dirname(resolve(trusted)) !== resolve(tmpdir())) throw new Error('Unsafe temporary cleanup path')
    await rm(trusted, { recursive: true, force: true })
  }
  const currentResponse = await fetcher(new URL('/release.json', gateway), { signal: AbortSignal.timeout(10000), cache: 'no-store' })
  if (!currentResponse.ok) throw new Error('Cannot identify the current frontend')
  const current = await currentResponse.json()
  const observed = await evidence(gateway, { expectedSha: current.sha })
  const matrix = JSON.parse(process.env.RELEASE_COMPATIBILITY_JSON || await readFile(matrixPath, 'utf8'))
  requireCompatible(matrix, candidate.sha, observed.backend.revision, observed.database.version, observed.database.checksum)
  return { sha: candidate.sha, certifiedRun: candidate.runUrl, previousFrontendSha: current.sha,
    backend: observed.backend, database: observed.database }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [dist, tag, matrix, gateway] = process.argv.slice(2)
    const result = await certifyRollback(dist, tag, matrix, gateway)
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `sha=${result.sha}\nbackendSha=${result.backend.revision}\n`)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    // gh may include private diagnostics; expose only our policy errors.
    console.error(error.cmd ? 'Unable to retrieve historical CI certification' : error.message)
    process.exitCode = 1
  }
}
