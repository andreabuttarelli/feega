import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { dragFrom, dragPan, instrument, measure, wheelZoom } from './fixtures/frame-sweeps';

const HOST_PAGE = '/changelog';
const DESKTOP = { width: 1440, height: 900 };
const SWEEP_MS = 6000;
const SETTLE_MS = 2500;
const COUNT = Number(process.env.CANVAS_STRESS_NODES ?? 500);
const THROTTLE = Number(process.env.CANVAS_PERF_THROTTLE ?? 1);
const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
const STEP = { x: 520, y: 640 };
const LIVE = process.env.CANVAS_LIVE ?? 'on';
const CANVAS = '[data-testid="webgl-canvas"]';
const DOM_NODE = '.svelte-flow__node';

const longTasks = () => {
  const box = { total: 0, count: 0 };
  (window as unknown as { __long: typeof box }).__long = box;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      box.total += entry.duration;
      box.count += 1;
    }
  }).observe({ type: 'longtask', buffered: false });
};

type Subject = { name: string; button: 'left' | 'middle'; open: (page: Page) => Promise<string>; centre: (page: Page) => Promise<{ x: number; y: number }> };

async function domNodes() {
  const poster = `data:image/jpeg;base64,${(await sharp({ create: { width: 1080, height: 1080, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 80, sigma: 40 } } }).jpeg().toBuffer()).toString('base64')}`;
  const columns = Math.ceil(Math.sqrt(COUNT));
  return Array.from({ length: COUNT }, (_, i) => ({ id: `n${i}`, x: (i % columns) * STEP.x, y: Math.floor(i / columns) * STEP.y, format: FORMATS[i % FORMATS.length], poster: '' })).map((n, i) => (i ? n : { ...n, poster }));
}

const pixi = (backend: string): Subject => ({
  name: `pixi-${backend}`,
  button: 'middle',
  open: async (page) => {
    await page.goto(HOST_PAGE);
    await page.evaluate((path) => import(path), '/tests/e2e/fixtures/webgl-canvas-harness.ts');
    const renderer = await page.evaluate(([n, b, l]) => window.webglCanvas.mount(n as number, b as never, l as never), [COUNT, backend, LIVE]);
    await expect(page.locator(CANVAS)).toBeVisible();
    return renderer;
  },
  centre: (page) => page.evaluate(() => window.webglCanvas.current!.centre())
});

const SUBJECTS: Subject[] = [
  {
    name: 'dom-xyflow',
    button: 'middle',
    open: async (page) => {
      const nodes = await domNodes();
      await page.goto(HOST_PAGE);
      await page.evaluate((path) => import(path), '/tests/e2e/fixtures/motion-canvas-harness.ts');
      await page.evaluate((list) => window.motionCanvas.mount(list.map((n) => ({ ...n, poster: list[0].poster }))), nodes);
      await expect(page.locator(DOM_NODE).first()).toBeVisible();
      return 'dom';
    },
    centre: async (page) => {
      const boxes = await page.locator(DOM_NODE).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
      const box = boxes.find((b) => b.x + b.width / 2 > 0 && b.y + b.height / 2 > 0 && b.x + b.width / 2 < DESKTOP.width && b.y + b.height / 2 < DESKTOP.height)!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
  },
  pixi('webgpu'),
  pixi('webgl')
];

async function heapMb(page: Page) {
  const used = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  return Math.round(used / 1e6);
}

test.use({ launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('webgl canvas spike vs DOM canvas @perf', () => {
  test.skip(!process.env.E2E_PERF, 'misura frame su questa macchina: E2E_PERF=1');
  test.setTimeout(240_000);
  test.use({ viewport: DESKTOP });

  for (const subject of SUBJECTS) {
    test(`${subject.name} ${COUNT}`, async ({ page }) => {
      await page.addInitScript(instrument);
      await page.addInitScript(longTasks);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      if (THROTTLE > 1) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      }
      const renderer = await subject.open(page);
      await page.waitForTimeout(SETTLE_MS);
      const corner = { x: 12, y: DESKTOP.height - 12 };

      const long0 = await page.evaluate(() => ({ ...(window as unknown as { __long: { total: number; count: number } }).__long }));
      const pan = await measure(page, SWEEP_MS, (until) => dragPan(page, until, corner, subject.button));
      const zoom = await measure(page, SWEEP_MS, (until) => wheelZoom(page, until));
      const long1 = await page.evaluate(() => ({ ...(window as unknown as { __long: { total: number; count: number } }).__long }));
      const heap = await heapMb(page);
      await subject.open(page);
      await page.waitForTimeout(SETTLE_MS);
      const from = await subject.centre(page);
      const drag = await measure(page, 0, () => dragFrom(page, from));
      const live = await page.evaluate(() => {
        const stats = window.webglCanvas?.current?.stats;
        if (!stats) {
          return null;
        }
        const med = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0;
        return { captures: stats.captures.length, captureMs: Math.round(med(stats.captures)), uploadMs: Math.round(med(stats.uploads) * 10) / 10 };
      });
      const long = { count: long1.count - long0.count, ms: Math.round(long1.total - long0.total) };

      console.log(`[webgl-canvas] throttle=${THROTTLE} live=${LIVE} ${subject.name} ${COUNT} ${JSON.stringify({ renderer, pan, zoom, drag, long, heap, live })}`);
    });
  }
});
