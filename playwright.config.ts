import { defineConfig, devices } from '@playwright/test';

// Smoke suite against the dev server with PLACEHOLDER Supabase env: every target page is
// db-free by design (see tests/e2e/README.md). Port 4173 stays clear of a developer's own
// `npm run dev` on 5173.
const E2E_PORT = 4173;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/fixtures/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.E2E_REAL_STACK === '1' ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: process.env.E2E_VIDEO === '1' ? 'on' : 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.E2E_REAL_STACK === '1' ? [{ name: 'webkit-iphone', testMatch: /canvas-motion-webgl/, use: { ...devices['iPhone 15'] } }, { name: 'webkit', testMatch: /selection-outline|dashboard-nav|gpu-canvas-no-scroll/, use: { ...devices['Desktop Safari'] } }] : []),
    ...(process.env.E2E_HEAVY_PHONE === '1' ? [{ name: 'webkit-iphone-heavy', testMatch: /phone-heavy-frame-memory|ipad-playback-fps|landing-edit-latency/ }] : []),
    ...(process.env.FLUID_TOUCH === '1' ? [{ name: 'webkit-touch', testMatch: /fluidity-touch/ }] : []),
    ...(process.env.E2E_PERF === '1' ? [{ name: 'webkit-perf', testMatch: /editor-scrub|fluidity-scorecard|canvas-core-perf/, use: { ...devices['Desktop Safari'] } }, { name: 'webkit-iphone-perf', testMatch: /canvas-core-perf/, use: { ...devices['iPhone 15'] } }] : [])
  ],
  webServer: {
    command: `npx vite dev --port ${E2E_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
      PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY ?? 'e2e-placeholder-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      PUBLIC_APP_URL: BASE_URL,
      ORIGIN: BASE_URL,
      NO_HMR: '1',
      ...(process.env.E2E_FAKE_IMAGES && process.env.LLM_BASE_URL ? { LLM_BASE_URL: process.env.LLM_BASE_URL } : {})
    }
  }
});
