import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.INSPECTOR_AUDIT_PORT ?? 4391);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: /inspector-audit\.spec\.ts/,
  timeout: 600_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--enable-unsafe-webgpu'] },
    ...(process.env.CI ? {} : { channel: 'chrome', headless: false })
  },
  webServer: {
    command: `npx vite-node tests/e2e/fixtures/inspector-audit/serve.ts ${PORT}`,
    cwd: '../..',
    url: `${BASE_URL}/favicon-16.png`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
