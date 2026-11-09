import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

enum BenchFixture {
  Zoom = 'zoom',
  Landings = 'landings'
}

const PORT = 5288;
const FIXTURE_KIND = process.env.BENCH_CASE === BenchFixture.Landings ? BenchFixture.Landings : BenchFixture.Zoom;
const LANDINGS_FILE = process.env.BENCH_FIXTURE ?? join(homedir(), 'Documents/feega-videos/perf/landings/landings.feega');
const FIXTURE: Record<BenchFixture, { file: string; make: string | null; spec: RegExp }> = {
  [BenchFixture.Zoom]: { file: join(tmpdir(), 'feega-zoom-bench.feega'), make: 'node scripts/perf/zoom-fixture.mjs', spec: /canvas-zoom-bench/ },
  [BenchFixture.Landings]: { file: LANDINGS_FILE, make: existsSync(LANDINGS_FILE) ? null : 'node scripts/perf/landings-fixture.mjs', spec: process.env.BENCH_SPEC ? new RegExp(process.env.BENCH_SPEC) : /canvas-landings-bench/ }
};
const { file, make, spec } = FIXTURE[FIXTURE_KIND];
const SERVED = join(tmpdir(), `feega-${FIXTURE_KIND}-served.feega`);

export default defineConfig({
  testDir: '.',
  testMatch: spec,
  timeout: 1_800_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: [make && `${make} "${file}"`, `cp "${file}" "${SERVED}"`, `node scripts/local.mjs ${SERVED} --port=${PORT}`].filter(Boolean).join(' && '),
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/favicon-16.png`,
    reuseExistingServer: false,
    timeout: 900_000
  }
});
