import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { test, chromium, type Page } from '@playwright/test';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';

const VIEWPORT = { width: 1440, height: 900 };
const VIEW_KEY = `feega:viewport:00000000-0000-4000-8000-00000000f002:${LANDINGS_FIXTURE_PLACE.canvasId}`;
const ZOOM = 0.4;
const STEPS = 24;
const STEP_PX = 200;
const STEP_WAIT_MS = 120;
const SETTLE_MS = 20_000;
const PAPER_TOLERANCE = 9;
const OUT = process.env.PAN_OUT ?? 'perf-results/pan-reveal';
const QUERY = process.env.PAN_QUERY ?? '';
const START = { x: -(LANDINGS_FIXTURE_CENTRE.x - 6000) * ZOOM, y: 0, zoom: ZOOM };

async function inkShare(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).resize(360, 225).raw().toBuffer({ resolveWithObject: true });
  const at = (i: number) => [data[i], data[i + 1], data[i + 2]];
  const paper = at(((info.height - 4) * info.width + 4) * info.channels);
  let ink = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = at(i);
    const isPaper = Math.abs(r - paper[0]) <= PAPER_TOLERANCE && Math.abs(g - paper[1]) <= PAPER_TOLERANCE && Math.abs(b - paper[2]) <= PAPER_TOLERANCE;
    const isWhite = r > 250 && g > 250 && b > 250;
    ink += isPaper || isWhite ? 0 : 1;
  }
  return ink / (data.length / info.channels);
}

async function panAcross(page: Page, dir: string): Promise<number[]> {
  mkdirSync(dir, { recursive: true });
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  const shares: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    await page.mouse.wheel(STEP_PX, 0);
    await page.waitForTimeout(STEP_WAIT_MS);
    const shot = await page.screenshot();
    writeFileSync(`${dir}/${String(i).padStart(3, '0')}.png`, shot);
    shares.push(await inkShare(shot));
  }
  return shares;
}

async function opened(query: string, settle: number) {
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START });
  return { browser, page, go: async (base: string) => {
    await page.goto(`${base}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}${query}`, { waitUntil: 'commit' });
    await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(settle);
  } };
}

test('panning across the canvas right after load reveals no empty frame', async ({ baseURL }) => {
  const run = await opened(QUERY, Number(process.env.PAN_WAIT ?? 4000));
  await run.go(baseURL!);
  const now = await panAcross(run.page, `${OUT}/early`);
  await run.page.waitForTimeout(SETTLE_MS);
  for (let i = 0; i < STEPS; i++) {
    await run.page.mouse.wheel(-STEP_PX, 0);
    await run.page.waitForTimeout(STEP_WAIT_MS);
  }
  await run.page.waitForTimeout(SETTLE_MS / 2);
  const reference = await panAcross(run.page, `${OUT}/reference`);
  await run.browser.close();

  const missing = now.map((share, i) => Math.max(0, reference[i] - share));
  const empty = missing.filter((m) => m > 0.02).length;
  writeFileSync(`${OUT}/shares.json`, JSON.stringify({ now, reference, missing, empty }, null, 1));
  console.log('PAN', JSON.stringify({ empty, worst: Math.max(...missing).toFixed(3) }));
});
