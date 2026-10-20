import { defineConfig } from '@playwright/test'

// Reuses the isolated real backend, never the deployment gateway.
process.env.PERFORMANCE_PREVIEW = '1'
export default defineConfig({
  testDir: './performance', testMatch: '**/*.perf.js',
  workers: 1, fullyParallel: false, retries: 0, forbidOnly: !!process.env.CI,
  timeout: 600000, expect: { timeout: 90000 },
  globalSetup: './e2e/setup.mjs',
  outputDir: 'e2e-artifacts/performance-results',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:25173', browserName: 'chromium',
    viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1,
    locale: 'zh-CN', timezoneId: 'UTC', serviceWorkers: 'block' }
})
