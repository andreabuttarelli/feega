import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { REAL_STACK, signInE2e } from './fixtures/session';
import { comparison, summarise, type RawRun, type Row } from '../../scripts/canvas-core-perf/summary';

const PROJECT = process.env.CORE_PERF_PROJECT ?? 'e472ff3c-4b1f-4b95-8f31-695e7940b40a';
const CANVAS = process.env.CORE_PERF_CANVAS ?? 'b5a892f3-3112-41b3-ab8c-5f7d0d69887d';
const RENDERERS = (process.env.CORE_PERF_RENDERERS ?? 'gpu,core').split(',');
const OUT = process.env.CORE_PERF_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'core-perf');
const SURFACE = '[data-canvas-surface]';
const PAN_STEPS = 40;
const PAN_PX = 12;
const ZOOM_STEPS = 24;
const ZOOM_DELTA = 40;
const SETTLE_MS = 1500;
const PINCH_STEPS = 12;
const PINCH_PX = 8;
const PINCH_GAP = 60;

type Zoom = (page: Page, centre: { x: number; y: number }, direction: 1 | -1) => Promise<void>;

const ACCOUNT = () => ({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });

async function openCanvas(page: Page, renderer: string): Promise<number> {
  const started = Date.now();
  await page.goto(`/p/${PROJECT}/c/${CANVAS}?renderer=${renderer}`, { waitUntil: 'load' });
  await page.locator(SURFACE).first().waitFor();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return Date.now() - started;
}

async function installProbe(page: Page) {
  await page.evaluate(() => {
    const probe = { inputs: [] as { input: number; paint: number }[], frames: [] as number[] };
    let last = 0;
    const tick = (t: number) => {
      if (last) {
        probe.frames.push(t - last);
      }
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const onInput = (e: Event) => requestAnimationFrame(() => requestAnimationFrame(() => probe.inputs.push({ input: e.timeStamp, paint: performance.now() })));
    addEventListener('pointermove', onInput, { capture: true, passive: true });
    addEventListener('wheel', onInput, { capture: true, passive: true });
    (window as unknown as { corePerf: typeof probe }).corePerf = probe;
  });
}

const wheelZoom: Zoom = async (page, _centre, direction) => {
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_STEPS / 2; i++) {
    await page.mouse.wheel(0, -direction * ZOOM_DELTA);
  }
  await page.keyboard.up('Control');
};

const pinchZoom: Zoom = async (page, centre, direction) => {
  await page.evaluate(
    ({ centre, direction, steps, px, gap }) => {
      const fire = (type: string, pointerId: number, x: number, y: number) => {
        const target = document.elementFromPoint(x, y) ?? document.body;
        target.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }));
      };
      const start = direction > 0 ? gap : gap + steps * px;
      fire('pointerdown', 1, centre.x - start, centre.y);
      fire('pointerdown', 2, centre.x + start, centre.y);
      let spread = start;
      for (let i = 0; i < steps; i++) {
        spread += direction * px;
        fire('pointermove', 1, centre.x - spread, centre.y);
        fire('pointermove', 2, centre.x + spread, centre.y);
      }
      fire('pointerup', 2, centre.x + spread, centre.y);
      fire('pointerup', 1, centre.x - spread, centre.y);
    },
    { centre, direction, steps: PINCH_STEPS, px: PINCH_PX, gap: PINCH_GAP }
  );
};

const viewOf = (page: Page) => page.locator(SURFACE).first().getAttribute('data-view');

async function drive(page: Page, zoom: Zoom) {
  const before = await viewOf(page);
  const box = (await page.locator(SURFACE).first().boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down({ button: 'middle' });
  for (let i = 0; i < PAN_STEPS; i++) {
    await page.mouse.move(centre.x - i * PAN_PX, centre.y - i * PAN_PX);
  }
  await page.mouse.up({ button: 'middle' });
  const panned = await viewOf(page);
  expect(panned, 'pan moved the camera').not.toBe(before);
  await zoom(page, centre, 1);
  await expect.poll(() => viewOf(page), { message: 'zoom changed the camera' }).not.toBe(panned);
  await zoom(page, centre, -1);
  await page.waitForTimeout(SETTLE_MS);
}

async function collect(page: Page, firstPaintMs: number): Promise<RawRun> {
  const probe = await page.evaluate(() => {
    const p = (window as unknown as { corePerf: { inputs: { input: number; paint: number }[]; frames: number[] } }).corePerf;
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return { ...p, heapBytes: memory?.usedJSHeapSize ?? null };
  });
  return { ...probe, firstPaintMs };
}

test.describe('canvas core vs gpu perf @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(600_000);

  test('heavy canvas, every renderer', async ({ browser, browserName }) => {
    const rows: Row[] = [];
    for (const renderer of RENDERERS) {
      const context = await browser.newContext(test.info().project.use);
      const page = await context.newPage();
      try {
        await signInE2e(page, ACCOUNT());
        const firstPaintMs = await openCanvas(page, renderer);
        await installProbe(page);
        await drive(page, test.info().project.use.hasTouch ? pinchZoom : wheelZoom);
        rows.push({ browser: browserName, renderer, summary: summarise(await collect(page, firstPaintMs)) });
      } finally {
        await context.close();
      }
    }
    const table = comparison(rows);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${new Date().toISOString().replace(/[:.]/g, '-')}-${browserName}.md`), table + '\n');
    console.log(table);
  });
});
