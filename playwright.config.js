import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: '**/*.e2e.js', fullyParallel: false, workers: 1,
  forbidOnly: !!process.env.CI, retries: 0, timeout: 100000,
  expect: { timeout: 15000 }, globalSetup: './e2e/setup.mjs',
  outputDir: 'e2e-artifacts/test-results',
  reporter: [['list'], ['html', { outputFolder: 'e2e-artifacts/report', open: 'never' }],
    ['junit', { outputFile: 'e2e-artifacts/results.xml' }]],
  use: { baseURL: 'http://127.0.0.1:25173', viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
