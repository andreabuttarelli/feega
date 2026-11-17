import { test, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';

const BASE = `http://127.0.0.1:${process.env.BENCH_PORT ?? 5288}`;
const OUT = process.env.PROBE_OUT ?? 'perf-results/viewload';
const CPU = Number(process.env.BUDGET_CPU ?? 1);
const SETTLE_MS = Number(process.env.PROBE_SETTLE_MS ?? 20_000);

test('when breakpoint views first show on load', async () => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (CPU > 1) {
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
  }
  await page.goto(`${BASE}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}`, { waitUntil: 'commit' });
  await page.waitForTimeout(SETTLE_MS);
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').filter((m) => m.name.startsWith('frame|')).map((m) => [m.name, Math.round(m.startTime)]));
  writeFileSync(join(OUT, `marks-cpu${CPU}.json`), JSON.stringify(marks));
  await browser.close();
});
