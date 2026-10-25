import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './demos',
  testMatch: /\.demo\.ts$/,
  timeout: 600_000,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: Number(process.env.DEMO_DPR ?? 2),
    headless: process.env.DEMO_HEADLESS === '1',
    launchOptions: { args: ['--window-position=-2400,0'] },
    permissions: ['clipboard-read', 'clipboard-write']
  }
});
