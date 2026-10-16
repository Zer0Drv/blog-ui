import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const manifestName = 'release.json'
const validSha = /^[0-9a-f]{40}$/

function requireSha(sha) {
  if (!validSha.test(sha ?? '')) throw new Error('Expected a full 40-character commit SHA')
}

async function inventory(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not release files: ${path}`)
    if (entry.isDirectory()) files.push(...await inventory(join(directory, entry.name), `${path}/`))
    else if (entry.isFile()) {
      if (path === manifestName) continue
      const bytes = await readFile(join(directory, entry.name))
      files.push({ path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    } else throw new Error(`Unsupported release entry: ${path}`)
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
}

function requireIndex(files) {
  if (!files.some(file => file.path === 'index.html')) throw new Error('Release must contain index.html')
}

export async function createManifest(directory, sha, runUrl) {
  requireSha(sha)
  if (!runUrl || !URL.canParse(runUrl) || new URL(runUrl).protocol !== 'https:') {
    throw new Error('Expected an HTTPS workflow run URL')
  }
  const files = await inventory(directory)
  requireIndex(files)
  const manifest = { schemaVersion: 1, sha, runUrl, files }
  await writeFile(join(directory, manifestName), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

export async function verifyManifest(directory, expectedSha) {
  requireSha(expectedSha)
  const manifest = JSON.parse(await readFile(join(directory, manifestName), 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.sha !== expectedSha || !Array.isArray(manifest.files)) {
    throw new Error('Release manifest does not match the expected commit or schema')
  }
  const names = new Set()
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || file.path.includes('\\') ||
        file.path.split('/').some(part => ['', '.', '..'].includes(part)) || names.has(file.path) ||
        !/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) {
      throw new Error('Invalid or duplicate release file entry')
    }
    names.add(file.path)
  }
  const files = await inventory(directory)
  requireIndex(files)
  if (JSON.stringify(files) !== JSON.stringify(manifest.files.map(({ path, size, sha256 }) => ({ path, size, sha256 })))) {
    throw new Error('Release file inventory or SHA-256 checksum mismatch')
  }
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, directory, sha, runUrl] = process.argv.slice(2)
  try {
    const manifest = mode === 'create' ? await createManifest(directory, sha, runUrl)
      : mode === 'verify' ? await verifyManifest(directory, sha)
        : (() => { throw new Error('Usage: release-manifest.mjs create|verify <dist> <sha> [runUrl]') })()
    console.log(`Verified release ${manifest.sha}: ${manifest.files.length} files`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
