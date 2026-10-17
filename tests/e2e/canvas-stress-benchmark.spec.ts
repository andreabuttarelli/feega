import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { dragFrom, dragPan, instrument, measure, wheelZoom } from './fixtures/frame-sweeps';

const REACT_FLOW_STRESS = 'https://example-apps.xyflow.com/react/examples/nodes/stress/index.html';
const REACT_FLOW_STRESS_NODES = 100;
const HOST_PAGE = '/changelog';
const DESKTOP = { width: 1440, height: 900 };
const SWEEP_MS = 6000;
const SETTLE_MS = 2000;
const COUNTS = (process.env.CANVAS_STRESS_NODES ?? '100,500').split(',').map(Number);
const THROTTLE = Number(process.env.CANVAS_PERF_THROTTLE ?? 1);
const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
const POSTER_PX = { w: 1080, h: 1080 };
const STEP = { x: 520, y: 640 };
const LIVE_ZOOM = 0.4;

async function zoomTo(page: Page, zoom: number) {
  const size = page.viewportSize()!;
  const scale = () => page.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.svelte-flow__viewport')?.getAttribute('style') ?? '')?.[1] ?? 0));
  await page.locator('.svelte-flow__viewport').waitFor();
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.keyboard.down('Control');
  while ((await scale()) < zoom) {
    await page.mouse.wheel(0, -60);
  }
  await page.keyboard.up('Control');
}

const NODE = '.svelte-flow__node, .react-flow__node';

type Subject = { name: string; button: 'left' | 'middle'; open: (page: Page, count: number) => Promise<void>; counts: number[] };

async function feegaNodes(count: number) {
  const poster = `data:image/jpeg;base64,${(await sharp({ create: { width: POSTER_PX.w, height: POSTER_PX.h, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 80, sigma: 40 } } }).jpeg().toBuffer()).toString('base64')}`;
  const columns = Math.ceil(Math.sqrt(count));
  return { poster, list: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, x: (i % columns) * STEP.x, y: Math.floor(i / columns) * STEP.y, format: FORMATS[i % FORMATS.length], poster: '' })) };
}

const SUBJECTS: Subject[] = [
  {
    name: 'react-flow-stress',
    button: 'left',
    counts: [REACT_FLOW_STRESS_NODES],
    open: async (page) => {
      await page.goto(REACT_FLOW_STRESS);
    }
  },
  {
    name: 'bare-svelte-flow',
    button: 'left',
    counts: COUNTS,
    open: async (page, count) => {
      await page.goto(HOST_PAGE);
      await page.evaluate((path) => import(path), '/tests/e2e/fixtures/bare-flow-harness.ts');
      await page.evaluate((n) => window.bareFlow.mount(n), count);
    }
  },
  {
    name: 'feega-live',
    button: 'middle',
    counts: COUNTS,
    open: async (page, count) => {
      const { list } = await feegaNodes(count);
      await page.goto(HOST_PAGE);
      await page.evaluate((path) => import(path), '/tests/e2e/fixtures/motion-canvas-harness.ts');
      await page.evaluate((nodes) => window.motionCanvas.mount(nodes.map((n) => ({ ...n, source: 'live' }))), list);
      await zoomTo(page, LIVE_ZOOM);
    }
  },
  {
    name: 'feega',
    button: 'middle',
    counts: COUNTS,
    open: async (page, count) => {
      const { poster, list } = await feegaNodes(count);
      await page.goto(HOST_PAGE);
      await page.evaluate((path) => import(path), '/tests/e2e/fixtures/motion-canvas-harness.ts');
      await page.evaluate(({ nodes, art }) => window.motionCanvas.mount(nodes.map((n) => ({ ...n, poster: art }))), { nodes: list, art: poster });
    }
  }
];

async function firstNodeCentre(page: Page) {
  const size = page.viewportSize()!;
  const boxes = await page.locator(NODE).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  const box = boxes.find((b) => b.x > 0 && b.y > 0 && b.right < size.width && b.bottom < size.height)!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('stress benchmark: React Flow demo, bare Svelte Flow, feega nodes @perf', () => {
  test.skip(!process.env.E2E_PERF, 'misura frame su questa macchina: E2E_PERF=1');
  test.setTimeout(180_000);
  test.use({ viewport: DESKTOP });

  for (const subject of SUBJECTS) {
    for (const count of subject.counts) {
      test(`${subject.name} ${count}`, async ({ page, browserName }) => {
        await page.addInitScript(instrument);
        if (THROTTLE > 1 && browserName === 'chromium') {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
        }
        await subject.open(page, count);
        await expect(page.locator(NODE).first()).toBeVisible();
        await page.waitForTimeout(SETTLE_MS);

        const mounted = await page.locator(NODE).count();
        const live = await page.locator('[data-drawn="true"]').count();
        const corner = { x: 12, y: DESKTOP.height - 12 };
        const pan = await measure(page, SWEEP_MS, (until) => dragPan(page, until, corner, subject.button));
        const zoom = await measure(page, SWEEP_MS, (until) => wheelZoom(page, until));
        await subject.open(page, count);
        await expect(page.locator(NODE).first()).toBeVisible();
        await page.waitForTimeout(SETTLE_MS);
        const from = await firstNodeCentre(page);
        const drag = await measure(page, 0, () => dragFrom(page, from));

        console.log(`[canvas-stress] ${test.info().project.name} ${subject.name} ${count} ${JSON.stringify({ mounted, live, pan, zoom, drag })}`);
      });
    }
  }
});
