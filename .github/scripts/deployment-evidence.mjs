import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { smokeGateway } from './gateway-smoke.mjs'

const execute = promisify(execFile)
const backendFormat = '{"image":{{json .Config.Image}},"imageId":{{json .Image}},"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}},"running":{{json .State.Running}}}'
// Credentials stay in the existing MySQL container; neither the command nor its output contains them.
const migrationQuery = 'SELECT JSON_OBJECT(\'schema\', DATABASE(), \'version\', version, \'description\', description, \'checksum\', checksum, \'success\', success, \'failedCount\', (SELECT COUNT(*) FROM flyway_schema_history WHERE success=0)) FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1'
const mysqlCommand = `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root --database="$MYSQL_DATABASE" --batch --raw --skip-column-names --execute="${migrationQuery}"`

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

export async function collectDeploymentEvidence(baseUrl, {
  expectedSha, backendContainer = 'blog-backend', mysqlContainer = 'blog-mysql',
  run = execute, smoke = smokeGateway
} = {}) {
  requireValue(/^[a-f0-9]{40}$/.test(expectedSha || ''), 'Expected a full frontend SHA')
  for (const name of [backendContainer, mysqlContainer]) {
    requireValue(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name), 'Invalid container name')
  }

  async function docker(args, label) {
    try {
      const { stdout } = await run('docker', args, { timeout: 10000, maxBuffer: 262144 })
      return JSON.parse(stdout.trim())
    } catch {
      // Child-process errors can include stderr. Keep it out of public CI evidence.
      throw new Error(`Unable to read ${label}; check Docker access, container readiness and Flyway history`)
    }
  }

  async function identity() {
    const backend = await docker(['inspect', '--format', backendFormat, backendContainer], 'backend identity')
    requireValue(backend.running === true && typeof backend.image === 'string' && backend.image.length > 0 &&
      /^[a-f0-9]{40}$/.test(backend.revision || '') && /^sha256:[a-f0-9]{64}$/.test(backend.imageId || ''),
    'Backend container is stopped or its image is missing a valid revision or immutable image ID')
    const database = await docker(['exec', mysqlContainer, 'sh', '-c', mysqlCommand], 'database migration')
    requireValue(typeof database.schema === 'string' && database.schema.length > 0 &&
      /^\d+(?:\.\d+)*$/.test(database.version || '') && database.success === 1 &&
      database.failedCount === 0 && Number.isInteger(database.checksum), 'Database migration is incomplete or invalid')
    return { backend, database }
  }

  const before = await identity()
  const gateway = await smoke(baseUrl, { expectedSha })
  requireValue(gateway.frontendSha === expectedSha, 'Gateway frontend SHA mismatch')
  const after = await identity()
  requireValue(before.backend.imageId === after.backend.imageId && before.backend.revision === after.backend.revision &&
    before.backend.image === after.backend.image && JSON.stringify(before.database) === JSON.stringify(after.database),
  'Deployment changed during verification; collect a fresh report')
  return {
    schemaVersion: 1, ...gateway, backend: after.backend, database: after.database,
    scope: 'Observed frontend/backend/schema combination passed anonymous gateway smoke; other upgrade or rollback combinations are not certified'
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await collectDeploymentEvidence(process.argv[2], {
      expectedSha: process.argv[3], backendContainer: process.env.BACKEND_CONTAINER || 'blog-backend',
      mysqlContainer: process.env.MYSQL_CONTAINER || 'blog-mysql'
    })
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ checkedAt: new Date().toISOString(), ok: false, error: error.message }) + '\n')
    process.stderr.write(`Deployment verification failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
