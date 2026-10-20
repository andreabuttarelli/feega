import { chromium } from '@playwright/test';
import heavy from '../../tests/e2e/fixtures/heavy-canvas-landings.json' with { type: 'json' };

const BASE = process.env.BENCH_BASE_URL ?? 'http://localhost:5199';
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
await page.press('input[type=password]', 'Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));

for (const pass of ['cold', 'warm']) {
  const t0 = Date.now();
  const marks: [string, number][] = [];
  const mark = (what: string) => marks.push([what, Date.now() - t0]);
  page.on('requestfinished', (r) => /\/api\/v1\/(projects|canvases)/.test(r.url()) && mark(`done ${r.url().split('?')[0].split('/').slice(-3).join('/').slice(0, 60)}`));
  page.on('request', (r) => /GpuFlow|CoreFrames|gpu_core|dm-sans|\/api\/v1\//.test(r.url()) && mark(`req ${r.url().split('/').slice(-2).join('/').slice(0, 60)}`));
  page.on('console', (m) => /\[canvas\]/.test(m.text()) && mark(`log ${m.text().slice(0, 80)}`));
  await page.goto(`${BASE}/p/${heavy.projectId}/c/${heavy.canvasId}${process.env.RENDERER ? `?renderer=${process.env.RENDERER}` : ''}`);
  mark('goto done');
  await page.locator('[data-canvas-surface]').waitFor({ state: 'attached', timeout: 60_000 });
  mark('flow attached');
  await page.locator('[data-testid=core-canvas]').waitFor({ state: 'attached', timeout: 60_000 });
  mark('core canvas attached');
  await page.locator('[data-testid=core-canvas]').waitFor({ timeout: 60_000 });
  mark('core canvas mounted');
  await page.waitForFunction(() => Number(document.querySelector('[data-testid=core-canvas]')?.getAttribute('data-cards') ?? 0) > 0, null, { timeout: 60_000 });
  mark('first cards drawn');
  await page.waitForFunction(() => Number(document.querySelector('[data-testid=core-canvas]')?.getAttribute('data-frames') ?? 0) > 0, null, { timeout: 60_000 }).catch(() => undefined);
  mark('first frames drawn');
  console.log(pass, JSON.stringify(marks.filter(([w], i) => marks.findIndex(([x]) => x === w) === i)));
  page.removeAllListeners('request');
  page.removeAllListeners('requestfinished');
  page.removeAllListeners('console');
}
await browser.close();
