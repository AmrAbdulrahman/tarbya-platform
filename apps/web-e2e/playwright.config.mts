import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// Plain config without Nx helpers: importing nx from here crashes on Node 22's require(esm) loader.
const workspaceRoot = resolve(import.meta.dirname, '../..');
const isCI = !!process.env['CI'];
const webServerAddress = isCI
  ? 'http://localhost:4300'
  : 'http://localhost:4200';
const baseURL = process.env['BASE_URL'] || webServerAddress;

export default defineConfig({
  testDir: './src',
  outputDir: resolve(
    workspaceRoot,
    'dist/.playwright/apps/web-e2e/test-output',
  ),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [
    [
      'html',
      {
        outputFolder: resolve(
          workspaceRoot,
          'dist/.playwright/apps/web-e2e/playwright-report',
        ),
        open: 'never',
      },
    ],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: isCI ? 'pnpm exec nx run web:preview' : 'pnpm exec nx run web:dev',
    url: webServerAddress,
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
