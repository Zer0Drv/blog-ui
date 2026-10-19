// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createManifest, verifyManifest } from '../.github/scripts/release-manifest.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const sha = '0123456789abcdef0123456789abcdef01234567'
const runUrl = 'https://github.com/Zer0Drv/blog-ui/actions/runs/123'
const temporary = []
const bash = process.env.WORKFLOW_TEST_BASH || (process.platform === 'win32' ? 'D:/Git/bin/bash.exe' : 'bash')

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'blog-release-'))
  temporary.push(directory)
  const dist = join(directory, 'dist')
  await mkdir(join(dist, 'assets'), { recursive: true })
  await writeFile(join(dist, 'index.html'), '<html><script src="/assets/app.js"></script></html>')
  await writeFile(join(dist, 'assets/app.js'), 'console.log("fixture")')
  return { directory, dist }
}

async function manifestUpdate(dist, update) {
  const path = join(dist, 'release.json')
  const value = JSON.parse(await readFile(path, 'utf8'))
  update(value)
  await writeFile(path, JSON.stringify(value))
}

async function shell(script, directory, environment = {}) {
  const scriptFile = join(directory, 'fixture.sh')
  await writeFile(scriptFile, script)
  const result = spawnSync(bash, ['--noprofile', '--norc', '-eo', 'pipefail', scriptFile.replaceAll('\\', '/')], {
    cwd: directory, env: { ...process.env, ...environment }, encoding: 'utf8', timeout: 15000
  })
  if (result.error) throw result.error
  return result
}

function jobSection(workflow, name) {
  const section = workflow.split(new RegExp(`^  ${name}:\\r?$`, 'm'))[1]
  expect(section, `missing job ${name}`).toBeDefined()
  return section.split(/^  [\w-]+:\r?$/m)[0]
}

async function gateScript() {
  const workflow = (await readFile(join(root, '.github/workflows/cd.yml'), 'utf8')).replaceAll('\r\n', '\n')
  return jobSection(workflow, 'gate').split('        run: |\n')[1].split('\n')
    .filter(line => line.startsWith('          ') || !line.trim()).map(line => line.slice(10)).join('\n')
}

describe('release inventory and exact commit', () => {
  it('records a complete inventory and verifies the exact bytes', async () => {
    const { dist } = await fixture()
    const manifest = await createManifest(dist, sha, runUrl)
    expect(manifest.files.map(file => file.path)).toEqual(['assets/app.js', 'index.html'])
    expect(await verifyManifest(dist, sha)).toEqual(manifest)
  })

  it.each(['changed', 'missing', 'extra', 'wrong commit', 'bad schema', 'duplicate', 'traversal', 'bad checksum'])(
    'rejects %s before release', async reason => {
      const { dist } = await fixture()
      await createManifest(dist, sha, runUrl)
      if (reason === 'changed') await writeFile(join(dist, 'assets/app.js'), 'altered')
      if (reason === 'missing') await rm(join(dist, 'assets/app.js'))
      if (reason === 'extra') await writeFile(join(dist, 'unexpected.js'), 'extra')
      if (reason === 'wrong commit') await manifestUpdate(dist, value => { value.sha = 'f'.repeat(40) })
      if (reason === 'bad schema') await manifestUpdate(dist, value => { value.schemaVersion = 2 })
      if (reason === 'duplicate') await manifestUpdate(dist, value => { value.files.push(value.files[0]) })
      if (reason === 'traversal') await manifestUpdate(dist, value => { value.files[0].path = '../outside.js' })
      if (reason === 'bad checksum') await manifestUpdate(dist, value => { value.files[0].sha256 = 'f'.repeat(64) })
      await expect(verifyManifest(dist, sha)).rejects.toThrow()
    }
  )

  it('rejects missing or invalid manifests and an invalid target SHA', async () => {
    const { dist } = await fixture()
    await expect(verifyManifest(dist, sha)).rejects.toThrow()
    await writeFile(join(dist, 'release.json'), '{broken')
    await expect(verifyManifest(dist, sha)).rejects.toThrow()
    await expect(createManifest(dist, 'main', runUrl)).rejects.toThrow('40-character')
  })

  it('requires an entry page', async () => {
    const { dist } = await fixture()
    await rm(join(dist, 'index.html'))
    await expect(createManifest(dist, sha, runUrl)).rejects.toThrow('index.html')
  })

  it('rejects directory links in downloaded output', async () => {
    const { dist, directory } = await fixture()
    await createManifest(dist, sha, runUrl)
    const outside = join(directory, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'outside.js'), 'outside')
    await symlink(outside, join(dist, 'assets/link'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(verifyManifest(dist, sha)).rejects.toThrow('Symbolic links')
  })
})

describe.skipIf(process.platform === 'win32' && !existsSync(bash))('actual workflow shell guards', () => {
  it.each([
    ['refs/heads/main', 'push', '', '', 0, 'true', 'false'],
    ['refs/heads/main', 'push', '[SKIP CD]', '', 0, 'false', 'false'],
    ['refs/heads/main', 'workflow_dispatch', '[skip cd]', '', 0, 'true', 'false'],
    ['refs/heads/main', 'workflow_dispatch', '', 'sha-1a2b3c4d', 0, 'true', 'true'],
    ['refs/heads/feature', 'push', '', '', 1],
    ['refs/heads/feature', 'workflow_dispatch', '', 'sha-1a2b3c4d', 1],
    ['refs/heads/main', 'workflow_dispatch', '', 'latest', 1],
    ['refs/heads/main', 'workflow_dispatch', '', 'sha-DEADBEEF', 1],
    ['refs/heads/main', 'workflow_dispatch', '', 'sha-12345678;echo bad', 1]
  ])('gates %s %s %s %s', async (ref, event, message, tag, status, deploy, rollback) => {
    const { directory } = await fixture()
    const output = join(directory, 'outputs')
    const result = await shell(await gateScript(), directory, {
      RELEASE_REF: ref, EVENT_NAME: event, MSG: message, ROLLBACK_TAG: tag, GITHUB_OUTPUT: output.replaceAll('\\', '/')
    })
    expect(result.status, result.stderr || result.stdout).toBe(status)
    if (status === 0) {
      const flags = await readFile(output, 'utf8')
      expect(flags).toContain(`deploy=${deploy}\n`)
      expect(flags).toContain(`rollback=${rollback}\n`)
    } else expect(existsSync(output)).toBe(false)
  })

  it.each(['valid', 'wrong commit', 'changed', 'missing manifest', 'wrong tag', 'archive failure'])(
    'does not write storage before verification: %s', async scenario => {
      const { directory, dist } = await fixture()
      await createManifest(dist, sha, runUrl)
      if (scenario === 'wrong commit') await manifestUpdate(dist, value => { value.sha = 'f'.repeat(40) })
      if (scenario === 'changed') await writeFile(join(dist, 'assets/app.js'), 'altered')
      if (scenario === 'missing manifest') await rm(join(dist, 'release.json'))
      const calls = join(directory, 'calls')
      const script = `
mc() {
  printf '%s\\n' "$*" >> "$MC_CALLS"
  if [[ "$FAIL_ARCHIVE" == true && "$1" == cp ]]; then return 1; fi
}
source "$PUBLISH_SCRIPT"
`
      const result = await shell(script, directory, {
        RELEASE_SHA: sha, FRONTEND_TAG: scenario === 'wrong tag' ? 'sha-ffffffff' : `sha-${sha.slice(0, 8)}`,
        NODE_BIN: process.execPath.replaceAll('\\', '/'), PUBLISH_SCRIPT: resolve(root, '.github/scripts/publish-frontend.sh').replaceAll('\\', '/'),
        MINIO_ACCESS_KEY: 'fixture', MINIO_SECRET_KEY: 'fixture', MC_CALLS: calls.replaceAll('\\', '/'),
        FAIL_ARCHIVE: String(scenario === 'archive failure')
      })
      expect(result.status, result.stderr || result.stdout).toBe(scenario === 'valid' ? 0 : 1)
      if (scenario === 'valid' || scenario === 'archive failure') {
        const operations = await readFile(calls, 'utf8')
        expect(operations).toContain('cp --recursive dist/ deploy/blog-frontend-releases/sha-01234567/')
        expect(operations.includes('mirror --overwrite --remove')).toBe(scenario === 'valid')
      } else expect(existsSync(calls)).toBe(false)
    }
  )
})

it('requires the whole same-commit CI and production approval before consuming its artifact', async () => {
  const cd = await readFile(join(root, '.github/workflows/cd.yml'), 'utf8')
  const ci = await readFile(join(root, '.github/workflows/ci.yml'), 'utf8')
  expect(ci).toContain('  workflow_call:')
  expect(jobSection(cd, 'ci')).toContain('uses: ./.github/workflows/ci.yml')
  expect(ci).toContain('value: ${{ jobs.build.outputs.artifact }}')
  const deploy = jobSection(cd, 'deploy')
  expect(deploy).toContain('needs: [gate, ci]')
  expect(deploy).toContain('!cancelled()')
  expect(deploy).toContain("needs.ci.result == 'success' && needs.ci.outputs.sha == github.sha")
  expect(deploy).toContain("needs.gate.outputs.rollback == 'true' && needs.ci.result == 'skipped'")
  expect(deploy).toContain('environment: production')
  expect(deploy).toContain('name: ${{ needs.ci.outputs.artifact }}')
  expect(deploy).toContain('ref: ${{ github.sha }}')
  expect(ci).toContain('ref: ${{ github.sha }}')
  for (const text of [ci, cd]) expect(text).not.toContain('continue-on-error:')
  expect(jobSection(ci, 'build')).not.toMatch(/^    if:/m)
  for (const command of ['pnpm install --frozen-lockfile', 'pnpm test', 'pnpm run build', 'test "$(git rev-parse HEAD)" = "$RELEASE_SHA"']) {
    const step = ci.split(/\r?\n\s+- name:/).find(value => value.includes(command))
    expect(step).toBeDefined()
    expect(step).not.toMatch(/^\s+if:/m)
  }
})

it('includes real browser E2E in complete reusable CI without optional execution', async () => {
  const ci = await readFile(join(root, '.github/workflows/ci.yml'), 'utf8')
  const e2e = jobSection(ci, 'browser-e2e')
  expect(e2e).not.toMatch(/^    if:/m)
  expect(e2e).not.toContain('continue-on-error:')
  expect(e2e).toContain('repository: Zer0Drv/blog')
  expect(e2e).toMatch(/ref: [a-f0-9]{40}/)
  const browserStep = e2e.split(/\r?\n\s+- name:/).find(step => step.includes('run: pnpm test:e2e'))
  expect(browserStep).toBeDefined()
  expect(browserStep).not.toMatch(/^\s+if:/m)
  expect(e2e).toContain('if: always()')
  expect(e2e).toContain('path: e2e-artifacts/')
})
