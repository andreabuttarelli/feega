import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { REAL_STACK, signInE2e } from './fixtures/session';
import heavy from './fixtures/heavy-canvas-landings.json' with { type: 'json' };

const LANDING = heavy.landings[0].desktop.nodeId;
const RENDERERS = [
  ['gpu', ''],
  ['dom', '?renderer=dom']
] as const;
const IDLE_MS = 6000;
const OPEN_MS = 20_000;
const AFTER_INTERACTIVE_MS = 600;
const WHEEL_ZOOM = 0.01;
const FILL_SHARE = 0.6;
const MIN_LUMA_SPREAD = 6;
const INSET_PX = 4;
const TAP_TO_OPEN_MS = 600;

type Box = { x: number; y: number; width: number; height: number };
type Sample = { at: number; spread: number };

const nodeSel = (id: string) => `.svelte-flow__node[data-id="${id}"]`;

async function lumaSpread(shot: Buffer): Promise<number> {
  const { data, info } = await sharp(shot).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let squares = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    sum += data[i];
    squares += data[i] * data[i];
  }
  const n = data.length / info.channels;
  return Math.sqrt(Math.max(0, squares / n - (sum / n) ** 2));
}

async function zoomOnto(page: Page, id: string) {
  const view = page.viewportSize()!;
  for (let i = 0; i < 3; i++) {
    const b = (await page.locator(nodeSel(id)).boundingBox())!;
    const scale = Math.min((view.width * FILL_SHARE) / b.width, (view.height * FILL_SHARE) / b.height);
    const at = { x: b.x + b.width / 2, y: Math.max(80, Math.min(b.y + b.height / 2, view.height - 80)) };
    await page.evaluate(({ x, y, deltaY }) => document.elementFromPoint(x, y)?.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY, ctrlKey: true, bubbles: true, cancelable: true })), { ...at, deltaY: -Math.log(scale) / WHEEL_ZOOM });
    await page.waitForTimeout(300);
  }
}

function inside(b: Box, view: { width: number; height: number }): Box {
  const x = Math.max(b.x, 0) + INSET_PX;
  const y = Math.max(b.y, 0) + INSET_PX;
  return { x, y, width: Math.min(b.x + b.width, view.width) - INSET_PX - x, height: Math.min(b.y + b.height, view.height) - INSET_PX - y };
}

const READY = { phone: '[data-testid="motion-editor"] [data-testid="editor-stage"][data-shown="true"]', desktop: '[data-testid="motion-editor"] .row.layer' };

const interactive = (page: Page) => page.locator(test.info().project.use.hasTouch ? READY.phone : READY.desktop).count().then((n) => n > 0);

async function open(page: Page, at: { x: number; y: number }) {
  if (test.info().project.use.hasTouch) {
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(TAP_TO_OPEN_MS);
    await page.mouse.dblclick(at.x, at.y);
    return;
  }
  await page.mouse.click(at.x, at.y);
}

async function screencast(page: Page, clip: Box) {
  const cdp = await page.context().newCDPSession(page);
  const frames: Promise<Sample>[] = [];
  const start = Date.now();
  cdp.on('Page.screencastFrame', (frame) => {
    void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined);
    const at = Date.now() - start;
    const image = sharp(Buffer.from(frame.data, 'base64'));
    frames.push(
      image.metadata().then(async ({ width = 0, height = 0 }) => {
        const scale = width / frame.metadata.deviceWidth;
        const left = Math.round(clip.x * scale);
        const top = Math.round((clip.y + frame.metadata.offsetTop) * scale);
        const area = { left, top, width: Math.min(Math.round(clip.width * scale), width - left), height: Math.min(Math.round(clip.height * scale), height - top) };
        return { at, spread: await lumaSpread(await image.extract(area).png().toBuffer()) };
      })
    );
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  return async () => {
    await cdp.send('Page.stopScreencast');
    return Promise.all(frames);
  };
}

async function shots(page: Page, clip: Box) {
  const samples: Sample[] = [];
  const start = Date.now();
  let on = true;
  const loop = (async () => {
    while (on) {
      samples.push({ at: Date.now() - start, spread: await lumaSpread(await page.screenshot({ clip })) });
    }
  })();
  return async () => {
    on = false;
    await loop;
    return samples;
  };
}

async function samplesWhileOpening(page: Page, clip: Box, at: { x: number; y: number }): Promise<Sample[]> {
  const stop = test.info().project.name === 'chromium' ? await screencast(page, clip) : await shots(page, clip);
  await open(page, at);
  await expect.poll(() => interactive(page), { timeout: OPEN_MS, message: 'the editor became interactive' }).toBe(true);
  await page.waitForTimeout(AFTER_INTERACTIVE_MS);
  return stop();
}

test.describe('opening a heavy frame never blanks the tile @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  for (const [renderer, query] of RENDERERS) {
    test(`${renderer}: the tile keeps a picture from the click until the editor is interactive`, async ({ page }) => {
      await signInE2e(page, { email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });
      await page.goto(`/p/${heavy.projectId}/c/${heavy.canvasId}${query}`, { waitUntil: 'load' });
      await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 4000 }).catch(() => undefined);
      await page.waitForTimeout(IDLE_MS);
      await page.locator('[data-canvas-surface], .svelte-flow').first().click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('Shift+Digit1');
      await page.waitForTimeout(800);
      await expect(page.locator(nodeSel(LANDING))).toHaveCount(1, { timeout: OPEN_MS });
      await zoomOnto(page, LANDING);
      await page.waitForTimeout(IDLE_MS);

      const box = (await page.locator(nodeSel(LANDING)).boundingBox())!;
      const clip = inside(box, page.viewportSize()!);
      const before = await lumaSpread(await page.screenshot({ clip }));
      expect(before, 'the tile shows the landing before the click').toBeGreaterThan(MIN_LUMA_SPREAD);

      const samples = await samplesWhileOpening(page, clip, { x: box.x + box.width / 2, y: clip.y + clip.height / 2 });
      const blank = samples.filter((s) => s.spread <= MIN_LUMA_SPREAD);
      console.log(`[${renderer}] ${samples.length} samples: ${samples.map((s) => `${s.at}:${s.spread.toFixed(0)}`).join(' ')}`);
      expect(samples.length).toBeGreaterThan(5);
      expect(blank, 'samples where the tile was a uniform colour').toEqual([]);
    });
  }
});
