import { test, chromium, type Page } from '@playwright/test';

const WATCH_MS = 45_000;
const TICK_MS = 100;
const STALL_MS = 250;
const APP_BASE = `http://127.0.0.1:${Number(process.env.BENCH_PORT ?? 5288) + 1}`;

const TARGETS: Record<string, { projectId: string; canvasId: string }> = {
  heavy: { projectId: process.env.PROBE_PROJECT ?? '9af789a4-da22-4231-bf6c-68bcb10b0377', canvasId: process.env.PROBE_CANVAS ?? 'bf55d313-9155-4de3-a5ef-c3c0259e98e2' },
  user: { projectId: '502b4c7d-3ab2-4a52-bebc-e3cce4465c45', canvasId: '9685d44d-6bb3-4d1f-9152-075aee712129' }
};

type Stall = { at: number; ms: number };

async function watch(page: Page, url: string) {
  const start = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  const stalls: Stall[] = [];
  let framesAt: number | null = null;

  while (Date.now() - start < WATCH_MS) {
    const t0 = Date.now();
    const frames = await page.evaluate(() => Number(document.querySelector('[data-testid=core-canvas]')?.getAttribute('data-frames') ?? 0)).catch(() => 0);
    const ms = Date.now() - t0;
    if (ms > STALL_MS) {
      stalls.push({ at: t0 - start, ms });
    }
    if (framesAt === null && frames > 0) {
      framesAt = Date.now() - start;
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }

  const last = stalls.at(-1);
  const interactive = last ? last.at + last.ms : (framesAt ?? 0);
  const longest = Math.max(0, ...stalls.map((s) => s.ms));
  return { framesAt, interactive, afterFrames: framesAt === null ? null : interactive - framesAt, stalls: stalls.length, longest, list: stalls };
}

for (const [name, place] of Object.entries(TARGETS)) {
  test(`${name} canvas opens without freezing`, async () => {
    test.setTimeout(240_000);
    const browser = await chromium.launch({ headless: process.env.PROBE_HEADLESS === '1', args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(`${APP_BASE}/login`);
    await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const result = await watch(page, `${APP_BASE}/p/${place.projectId}/c/${place.canvasId}`);
    console.log('FREEZE', name, JSON.stringify(result));
    await browser.close().catch(() => {});
  });
}
