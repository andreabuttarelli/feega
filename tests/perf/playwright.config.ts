import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 5288;
const FIXTURE = join(tmpdir(), 'feega-zoom-bench.feega');

export default defineConfig({
  testDir: '.',
  timeout: 900_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `node scripts/perf/zoom-fixture.mjs ${FIXTURE} && node scripts/local.mjs ${FIXTURE} --port=${PORT}`,
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/favicon-16.png`,
    reuseExistingServer: false,
    timeout: 600_000
  }
});
