import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, join } from 'node:path'

// CI fallback after cancellation or interrupted global setup. Never uses the default compose project.
const execute = promisify(execFile)
let runtime
try { runtime = JSON.parse(await readFile('e2e-artifacts/runtime.json', 'utf8')) } catch (error) {
  if (error.code === 'ENOENT') process.exit(0)
  throw error
}
if (!/^[a-f0-9]{32}$/.test(runtime.runId || '') || runtime.project !== `blog-browser-e2e-${runtime.runId.slice(0, 12)}`) {
  throw new Error('Refusing cleanup without this run\'s generated project identity')
}
if (!process.env.BACKEND_E2E_DIR) throw new Error('BACKEND_E2E_DIR is required for cleanup')
const args = ['compose', '--env-file', resolve('e2e/empty.env'), '-p', runtime.project,
  '-f', join(resolve(process.env.BACKEND_E2E_DIR), 'compose.real-it.yaml')]
try {
  const { stdout, stderr } = await execute('docker', [...args, 'logs', '--no-color'], { maxBuffer: 8 * 1024 * 1024 })
  if (stdout.trim()) await writeFile('e2e-artifacts/infrastructure-final.log', stdout + stderr)
} finally {
  await execute('docker', [...args, 'down', '--remove-orphans'], { timeout: 120000 })
}
