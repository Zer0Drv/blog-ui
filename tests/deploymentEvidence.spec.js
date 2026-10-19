// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { collectDeploymentEvidence } from '../.github/scripts/deployment-evidence.mjs'

const sha = '0123456789abcdef0123456789abcdef01234567'
const revision = 'a'.repeat(40)
const backend = { image: 'ghcr.io/zer0drv/blog-backend:sha-aaaaaaaa', revision, imageId: `sha256:${'b'.repeat(64)}`, running: true }
const database = { schema: 'blog_dev', version: '16', description: 'attachment cleanup', checksum: 1234, success: 1, failedCount: 0 }

function fixture(change = () => {}) {
  const state = { backend: { ...backend }, database: { ...database } }
  change(state)
  const run = vi.fn(async (command, args) => ({ stdout: JSON.stringify(args[0] === 'inspect' ? state.backend : state.database) }))
  const smoke = vi.fn(async () => ({ checkedAt: '2026-10-19T03:26:00Z', frontendSha: sha, gateway: 'http://localhost', checks: [] }))
  return { run, smoke, state, expectedSha: sha }
}

describe('deployment identity around gateway verification', () => {
  it('captures the exact deployed image and schema, not the frontend workflow SHA as the backend SHA', async () => {
    const options = fixture()
    const report = await collectDeploymentEvidence('http://localhost', options)
    expect(report.backend).toEqual(backend)
    expect(report.database).toEqual(database)
    expect(report.frontendSha).toBe(sha)
    expect(report.scope).toContain('other upgrade or rollback combinations are not certified')
    expect(options.smoke).toHaveBeenCalledWith('http://localhost', { expectedSha: sha })
    expect(options.run.mock.calls.map(([, args]) => args[0])).toEqual(['inspect', 'exec', 'inspect', 'exec'])
    const sql = options.run.mock.calls[1][1].at(-1)
    expect(sql).toContain('SELECT JSON_OBJECT')
    expect(sql).toContain('$MYSQL_ROOT_PASSWORD')
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER)\b/i)
  })

  it.each([
    ['missing revision', value => { value.backend.revision = null }],
    ['invalid image ID', value => { value.backend.imageId = 'latest' }],
    ['missing image', value => { value.backend.image = '' }],
    ['stopped backend', value => { value.backend.running = false }],
    ['missing schema', value => { value.database.schema = null }],
    ['failed migration', value => { value.database.success = 0 }],
    ['earlier failed migration', value => { value.database.failedCount = 1 }],
    ['invalid schema', value => { value.database.version = '' }],
    ['invalid checksum', value => { value.database.checksum = null }]
  ])('refuses %s before gateway verification', async (_, change) => {
    const options = fixture(change)
    await expect(collectDeploymentEvidence('http://localhost', options)).rejects.toThrow()
    expect(options.smoke).not.toHaveBeenCalled()
  })

  it.each(['backend', 'database'])('refuses a %s change during the gateway check', async field => {
    const options = fixture()
    options.smoke.mockImplementation(async () => {
      if (field === 'backend') options.state.backend.imageId = `sha256:${'c'.repeat(64)}`
      else options.state.database.version = '17'
      return { frontendSha: sha }
    })
    await expect(collectDeploymentEvidence('http://localhost', options)).rejects.toThrow('Deployment changed')
  })

  it('does not include subprocess stderr or credentials in failure evidence', async () => {
    const options = fixture()
    options.run.mockRejectedValue(new Error('stderr: secret-password'))
    await expect(collectDeploymentEvidence('http://localhost', options)).rejects.toThrow('Unable to read backend identity')
    try { await collectDeploymentEvidence('http://localhost', options) } catch (error) {
      expect(error.message).not.toContain('secret-password')
    }
  })

  it('propagates gateway failure and rejects an unexpected frontend SHA', async () => {
    const options = fixture()
    options.smoke.mockRejectedValueOnce(new Error('Gateway frontend SHA mismatch'))
    await expect(collectDeploymentEvidence('http://localhost', options)).rejects.toThrow('SHA mismatch')
    options.smoke.mockResolvedValue({ frontendSha: revision })
    await expect(collectDeploymentEvidence('http://localhost', options)).rejects.toThrow('SHA mismatch')
  })

  it.each([{ expectedSha: 'main' }, { backendContainer: '--help' }, { mysqlContainer: 'bad;command' }])(
    'rejects invalid inputs before running Docker: %j', async input => {
      const options = { ...fixture(), ...input }
      await expect(collectDeploymentEvidence('http://localhost', options)).rejects.toThrow()
      expect(options.run).not.toHaveBeenCalled()
    }
  )
})
