import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated, signInE2e } from './fixtures/session';

const SETTLE_MS = 5000;
const STEP_SETTLE_MS = 600;
const RUNS = Number(process.env.PAINTED_RUNS ?? 5);
const INK_DELTA = 10;
const MIN_SIDE_PX = 16;
const ZOOM_STEPS = 16;
const ACCOUNT = () => ({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });

async function unpainted(page: Page): Promise<string[]> {
  const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
  const { data, info } = await sharp(await page.screenshot({ clip: pane })).raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / pane.width;
  const px = (x: number, y: number) => {
    const i = (Math.round(y * scale) * info.width + Math.round(x * scale)) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const ground = px(3, 3);
  const boxes = await page.locator('.svelte-flow__node').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-id')!, r: e.getBoundingClientRect().toJSON() as DOMRect })));
  return boxes.flatMap(({ id, r }) => {
    const x0 = Math.max(r.x, pane.x) - pane.x;
    const y0 = Math.max(r.y, pane.y) - pane.y;
    const x1 = Math.min(r.x + r.width, pane.x + pane.width) - pane.x;
    const y1 = Math.min(r.y + r.height, pane.y + pane.height) - pane.y;
    if (x1 - x0 < MIN_SIDE_PX || y1 - y0 < MIN_SIDE_PX) {
      return [];
    }
    let inked = 0;
    let total = 0;
    const step = Math.max(1, Math.min(x1 - x0, y1 - y0) / 32);
    for (let y = y0 + 2; y < y1 - 2; y += step) {
      for (let x = x0 + 2; x < x1 - 2; x += step) {
        total += 1;
        inked += px(x, y).some((c, k) => Math.abs(c - ground[k]) > INK_DELTA) ? 1 : 0;
      }
    }
    return inked === 0 && total > 0 ? [id.slice(0, 8)] : [];
  });
}

async function open(page: Page) {
  await gotoHydrated(page, `/p/${process.env.GPU_FIXTURE_PROJECT}/c/${process.env.GPU_FIXTURE_CANVAS}`);
  await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
}

test.describe('every visible node on the GPU canvas stays painted @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.skip(!process.env.GPU_FIXTURE_CANVAS, 'GPU_FIXTURE_PROJECT + GPU_FIXTURE_CANVAS: a copy made by copy-canvas.mjs in the test org');
  test.setTimeout(600_000);

  test('cold, after a window resize and warm, without moving the camera', async ({ browser }) => {
    for (let run = 0; run < RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: (process.env.PAINTED_SCHEME as 'dark' | 'light') ?? 'light' });
      const page = await ctx.newPage();
      await signInE2e(page, ACCOUNT());
      await open(page);
      expect(await unpainted(page), `cold run ${run}`).toEqual([]);
      await page.setViewportSize({ width: 1280, height: 840 });
      await page.waitForTimeout(SETTLE_MS);
      expect(await unpainted(page), `cold run ${run}, after a resize`).toEqual([]);
      await open(page);
      expect(await unpainted(page), `warm run ${run}`).toEqual([]);
      await ctx.close();
    }
  });

  test('the canvas shows itself only once every node in view has its preview', async ({ browser }) => {
    const reveals: string[] = [];
    for (let run = 0; run < RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await signInE2e(page, ACCOUNT());
      for (const visit of ['cold', 'warm']) {
        await gotoHydrated(page, `/p/${process.env.GPU_FIXTURE_PROJECT}/c/${process.env.GPU_FIXTURE_CANVAS}`);
        await page.waitForSelector('[data-revealed="true"]', { timeout: 30_000 });
        const reveal = await page.evaluate(() => (window as unknown as { __gpuCanvas?: { reveal?: { ms: number; missing: string[] } } }).__gpuCanvas?.reveal);
        const settled = await page.waitForFunction(() => (window as unknown as { __gpuCanvas?: { settled?: number } }).__gpuCanvas?.settled, undefined, { timeout: 30_000 }).then((h) => h.jsonValue()).catch(() => null);
        reveals.push(`${visit} ${run}: shown ${reveal?.ms} ms with ${reveal?.missing.length} missing, all painted ${settled} ms`);
        console.log(`[reveal] ${reveals.at(-1)}`);
        expect.soft(reveal?.missing, `${visit} run ${run}: nodes without a preview when the canvas appeared`).toEqual([]);
        await page.waitForTimeout(visit === 'cold' ? SETTLE_MS * 4 : 0);
      }
      await ctx.close();
    }
    console.log(`[reveal] ${reveals.join(' | ')}`);
  });

  test('zooming out to the minimum and back, at every step', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: (process.env.PAINTED_SCHEME as 'dark' | 'light') ?? 'light' });
    const page = await ctx.newPage();
    const failures: string[] = [];
    page.on('console', (m) => m.text().includes('render failed') && failures.push(m.text().slice(0, 200)));
    await signInE2e(page, ACCOUNT());
    await open(page);
    const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    const steps = [...Array(ZOOM_STEPS).fill(-120), ...Array(ZOOM_STEPS * 2).fill(120), ...Array(ZOOM_STEPS).fill(-120)];
    for (const [i, dy] of steps.entries()) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, dy);
      await page.keyboard.up('Control');
      await page.waitForTimeout(STEP_SETTLE_MS);
      const zoom = (await page.locator('[data-canvas-surface]').getAttribute('data-view'))?.split(',')[2];
      const missing = await unpainted(page);
      if (missing.length) {
        await page.screenshot({ path: test.info().outputPath(`step-${i}.png`) });
      }
      expect(missing, `step ${i} at zoom ${zoom}`).toEqual([]);
    }
    expect(failures, 'the GPU canvas never fails a frame').toEqual([]);
    await ctx.close();
  });
});
