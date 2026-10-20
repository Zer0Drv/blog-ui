// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createManifest } from '../.github/scripts/release-manifest.mjs'
import { certifyRollback, requireCertifiedRun, requireCompatible } from '../.github/scripts/certify-rollback.mjs'

const sha = 'a'.repeat(40)
const run = { head_sha: sha, head_branch: 'main', conclusion: 'success', path: '.github/workflows/cd.yml', event: 'push' }
const jobs = ['build', 'browser-e2e'].map(name => ({ name: `ci / ${name}`, conclusion: 'success' }))

describe('历史回滚认证', () => {
  it.each([false, true])('与原始 Actions 产物核对，拒绝自行重算清单的伪造归档（伪造=%s）', async forged => {
    const directory = await mkdtemp(join(tmpdir(), 'blog-rollback-test-'))
    try {
      const dist = join(directory, 'dist')
      await mkdir(dist)
      await writeFile(join(dist, 'index.html'), forged ? 'forged' : 'original')
      const url = 'https://github.com/Zer0Drv/blog-ui/actions/runs/123'
      await createManifest(dist, sha, url)
      const matrixPath = join(directory, 'matrix.json')
      await writeFile(matrixPath, JSON.stringify({ schemaVersion: 1, cases: [
        { frontendSha: sha, backendSha: 'b'.repeat(40), schema: '17', schemaChecksum: 123 }
      ] }))
      const execute = async (_command, args) => {
        if (args[0] === 'api') return { stdout: JSON.stringify(args[1].includes('/jobs')
          ? { total_count: jobs.length, jobs } : run) }
        const target = args.at(-1)
        await writeFile(join(target, 'index.html'), 'original')
        await createManifest(target, sha, url)
        return { stdout: '' }
      }
      const evidence = vi.fn().mockResolvedValue({ backend: { revision: 'b'.repeat(40) }, database: { version: '17', checksum: 123 } })
      const operation = certifyRollback(dist, `sha-${sha.slice(0, 8)}`, matrixPath, 'http://localhost', {
        run: execute, evidence, fetcher: async () => ({ ok: true, json: async () => ({ sha: 'c'.repeat(40) }) })
      })
      if (forged) {
        await expect(operation).rejects.toThrow('original CI artifact')
        expect(evidence).not.toHaveBeenCalled()
      } else {
        expect((await operation).sha).toBe(sha)
        expect(evidence).toHaveBeenCalledOnce()
      }
      expect(await readFile(join(dist, 'index.html'), 'utf8')).toBe(forged ? 'forged' : 'original')
    } finally {
      if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error('Unsafe test cleanup')
      await rm(directory, { recursive: true, force: true })
    }
  })
  it('只接受精确 main 提交成功 CD 和完整必要 CI', () => {
    expect(() => requireCertifiedRun(run, jobs, sha)).not.toThrow()
    for (const change of [{ head_sha: 'b'.repeat(40) }, { head_branch: 'feature' },
      { conclusion: 'failure' }, { path: '.github/workflows/ci.yml' }, { event: 'pull_request' }]) {
      expect(() => requireCertifiedRun({ ...run, ...change }, jobs, sha)).toThrow()
    }
    expect(() => requireCertifiedRun(run, jobs.slice(0, 1), sha)).toThrow()
    expect(() => requireCertifiedRun(run, [...jobs, { name: 'ci / performance-baseline', conclusion: 'failure' }], sha)).toThrow()
  })
  it('未知组合、旧 schema 或后端变更均阻止写入', () => {
    const matrix = { schemaVersion: 1, cases: [{ frontendSha: sha, backendSha: 'b'.repeat(40), schema: '17', schemaChecksum: 123 }] }
    expect(() => requireCompatible(matrix, sha, 'b'.repeat(40), '17', 123)).not.toThrow()
    expect(() => requireCompatible(matrix, sha, 'b'.repeat(40), '17', 124)).toThrow()
    for (const args of [[sha, 'b'.repeat(40), '16'], [sha, 'c'.repeat(40), '17'], ['d'.repeat(40), 'b'.repeat(40), '17']]) {
      expect(() => requireCompatible(matrix, ...args)).toThrow()
    }
  })
})
