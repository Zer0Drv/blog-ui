import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`E2E port ${port} is already in use; no existing process will be stopped`)))
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}

export default async function setup() {
  if (!process.env.BACKEND_E2E_DIR) throw new Error('BACKEND_E2E_DIR must point to the compiled backend fixture checkout')
  const backend = resolve(process.env.BACKEND_E2E_DIR)
  const jar = join(backend, 'target/blog-0.0.1-SNAPSHOT.jar')
  await stat(jar)
  await stat(join(backend, 'target/test-classes/com/zer0drv/blog/realit/BrowserE2EServer.class'))
  await requireFreePort(28082)
  await requireFreePort(25173)
  const run = randomUUID().replaceAll('-', '')
  const project = `blog-browser-e2e-${run.slice(0, 12)}`
  const output = join(root, 'e2e-artifacts')
  await mkdir(output, { recursive: true })
  await writeFile(join(output, 'runtime.json'), JSON.stringify({ project, runId: run }))
  const compose = ['compose', '--env-file', join(root, 'e2e/empty.env'), '-p', project,
    '-f', join(backend, 'compose.real-it.yaml')]
  const children = []
  let composeStarted = false

  function start(command, args, cwd, env, name) {
    const log = createWriteStream(join(output, `${name}.log`))
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    child.on('error', error => log.write(`Unable to start ${name}: ${error.message}\n`))
    children.push({ child, log })
    return child
  }

  async function cleanup() {
    for (const { child, log } of children.reverse()) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i++) await pause(100)
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      }
      log.end()
    }
    if (composeStarted) {
      try {
        const { stdout, stderr } = await execute('docker', [...compose, 'logs', '--no-color'], { maxBuffer: 8 * 1024 * 1024 })
        await writeFile(join(output, 'infrastructure.log'), stdout + stderr)
      } finally {
        await execute('docker', [...compose, 'down', '--remove-orphans'], { timeout: 120000 })
      }
    }
  }

  try {
    composeStarted = true
    await execute('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '150'], { timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
    const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'
    const backendChild = start(java, ['-Duser.timezone=UTC', `-Dloader.path=${join(backend, 'target/test-classes')}`,
      '-Dloader.main=com.zer0drv.blog.realit.BrowserE2EServer', '-cp', jar,
      'org.springframework.boot.loader.launch.PropertiesLauncher'], backend,
    { ...process.env, BROWSER_E2E_RUN: run }, 'backend')
    let fixture
    for (let i = 0; i < 600; i++) {
      if (backendChild.exitCode !== null) throw new Error('Isolated backend exited; see e2e-artifacts/backend.log')
      try {
        fixture = JSON.parse(await readFile(join(backend, 'target/browser-e2e/fixture.json'), 'utf8'))
        if (fixture.runId === run) break
      } catch { /* The file is written only after real startup and seed completion. */ }
      fixture = null
      await pause(200)
    }
    if (!fixture) throw new Error('Isolated backend did not become ready; see backend.log')
    const health = await fetch('http://127.0.0.1:28082/actuator/health', { signal: AbortSignal.timeout(5000) })
    if (!health.ok || (await health.json()).status !== 'UP') throw new Error('Isolated backend is not healthy')
    await writeFile(join(output, 'fixture.json'), JSON.stringify(fixture, null, 2))
    const vite = start(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '25173'], root,
      { ...process.env, VITE_PORT: '25173', API_TARGET: 'http://127.0.0.1:28082' }, 'frontend')
    let ready = false
    for (let i = 0; i < 150; i++) {
      if (vite.exitCode !== null) throw new Error('Isolated frontend exited; see frontend.log')
      try { ready = (await fetch('http://127.0.0.1:25173', { signal: AbortSignal.timeout(1000) })).ok } catch { /* startup */ }
      if (ready) break
      await pause(200)
    }
    if (!ready) throw new Error('Isolated frontend did not become ready')
    const revision = async directory => (await execute('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim()
    const dirty = async directory => (await execute('git', ['status', '--porcelain'], { cwd: directory })).stdout.trim().length > 0
    await writeFile(join(output, 'versions.json'), JSON.stringify({ runId: run, project,
      frontendSha: await revision(root), backendSha: await revision(backend),
      sourceDirty: { frontend: await dirty(root), backend: await dirty(backend) },
      backendPort: 28082, frontendPort: 25173, mysqlPort: 23307, redisPort: 26379, minioPort: 29000,
      note: 'Dedicated tmpfs services; test-only seeded accounts; no production ports, volumes or credentials' }, null, 2))
    return cleanup
  } catch (error) {
    await cleanup()
    throw error
  }
}
