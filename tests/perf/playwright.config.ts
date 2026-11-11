import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

enum BenchFixture {
  Zoom = 'zoom',
  Landings = 'landings',
  Load = 'load',
  Budget = 'budget'
}

const PORT = Number(process.env.BENCH_PORT ?? 5288);
const FIXTURE_KIND = Object.values(BenchFixture).find((k) => k === process.env.BENCH_CASE) ?? BenchFixture.Zoom;
const LANDINGS_FILE = process.env.BENCH_FIXTURE ?? join(homedir(), 'Documents/feega-videos/perf/landings/landings.feega');
const FIXTURE: Record<BenchFixture, { file: string; make: string | null; spec: RegExp }> = {
  [BenchFixture.Zoom]: { file: join(tmpdir(), 'feega-zoom-bench.feega'), make: 'node scripts/perf/zoom-fixture.mjs', spec: /canvas-zoom-bench/ },
  [BenchFixture.Landings]: { file: LANDINGS_FILE, make: existsSync(LANDINGS_FILE) ? null : 'node scripts/perf/landings-fixture.mjs', spec: /canvas-landings-bench/ },
  [BenchFixture.Load]: { file: LANDINGS_FILE, make: null, spec: /canvas-load-bench/ },
  [BenchFixture.Budget]: { file: LANDINGS_FILE, make: null, spec: /canvas-frame-budget/ }
};
const { file, make, spec } = FIXTURE[FIXTURE_KIND];
const SERVED = join(tmpdir(), `feega-${FIXTURE_KIND}-served.feega`);

const FIXTURE_SERVER = {
  command: [make && `${make} "${file}"`, `cp "${file}" "${SERVED}"`, `node scripts/local.mjs ${SERVED} --port=${PORT}`].filter(Boolean).join(' && '),
  cwd: '../..',
  url: `http://127.0.0.1:${PORT}/favicon-16.png`,
  reuseExistingServer: false,
  timeout: 900_000
};

const APP_SERVER = {
  command: `PORT=${PORT + 1} HOST=127.0.0.1 ORIGIN=http://127.0.0.1:${PORT + 1} node --env-file-if-exists=.env build/index.js`,
  cwd: '../..',
  url: `http://127.0.0.1:${PORT + 1}/favicon-16.png`,
  reuseExistingServer: false,
  timeout: 120_000
};

export default defineConfig({
  testDir: '.',
  testMatch: process.env.BENCH_SPEC ? new RegExp(process.env.BENCH_SPEC) : spec,
  timeout: 1_800_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: FIXTURE_KIND === BenchFixture.Load ? undefined : [FIXTURE_SERVER, ...(FIXTURE_KIND === BenchFixture.Budget ? [APP_SERVER] : [])]
});
