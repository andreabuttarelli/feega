import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import sharp from 'sharp';
import { frameDiffs, motionJolts } from '../smoothness';
import type { VectorUi } from '../vector-ui/model';
import { ShotId, shotSource } from './library';
import { shotCursor } from './ops';
import FEEGA_APP from './fixtures/feega-app-vector.json';

const UI = FEEGA_APP as unknown as VectorUi;
const FPS = 30;
const PROBE = { width: 108, height: 192 };
const ASPECTS = { '9:16': { width: 1080, height: 1920 }, '16:9': { width: 1920, height: 1080 }, '1:1': { width: 1080, height: 1080 } };
const CAPTURE_SCALE = 0.5;
const SHOTS: { shot: ShotId; seconds: number; slots: Record<string, unknown> }[] = [
  { shot: ShotId.UiFocus, seconds: 4, slots: { field_id: 'input-0', button_id: 'button-5', type_text: 'a launch film for feega' } },
  { shot: ShotId.UiMorph, seconds: 3, slots: { from_id: 'button-6', to_id: 'button-8' } },
  { shot: ShotId.UiFocus, seconds: 4, slots: { field_id: 'input-0', button_id: 'button-5', cursor: [{ target: 'link-1', action: 'hover' }, { target: 'input-0', action: 'type', text: 'stripe.com' }, { target: 'button-5', action: 'click' }] } }
];

const STAGE = (js: string, props: Record<string, unknown>, duration: number) => `
const root = document.getElementById('root');
const updates = [];
let now = 0;
const param = (k, d) => (k in PROPS ? PROPS[k] : d);
const tl = { to: (_, o) => updates.push(() => o.onUpdate.call({ time: () => now })) };
const PROPS = ${JSON.stringify(props)};
(function (root, param, tl, duration, rand) { ${js} })(root, param, tl, ${duration}, () => 0.5);
window.seekTo = (t) => { now = t; updates.forEach((u) => u()); };
`;

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function diffsOf(source: { js: string; css: string }, props: Record<string, unknown>, seconds: number, size: { width: number; height: number }) {
  const page = await browser.newPage({ viewport: size });
  await page.setContent(`<html><head><style>${source.css}</style></head><body style="margin:0;background:#000"><div id="root" style="position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden"></div></body></html>`);
  await page.addScriptTag({ content: STAGE(source.js, props, seconds) });
  const cdp = await page.context().newCDPSession(page);
  const capture = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, ...size, scale: CAPTURE_SCALE } })).data, 'base64');
  const frames: Buffer[] = [];
  await capture();
  for (let i = 0; i < Math.round(seconds * FPS); i++) {
    await page.evaluate((t) => (window as unknown as { seekTo: (t: number) => void }).seekTo(t), i / FPS);
    const shot = await capture();
    frames.push(await sharp(shot).resize(PROBE.width, PROBE.height, { fit: 'fill' }).greyscale().raw().toBuffer());
  }
  await page.close();
  return frameDiffs(frames);
}

describe('the cursor shots render without a jump', () => {
  it.each(SHOTS.flatMap((s) => Object.entries(ASPECTS).map(([aspect, size]) => [s.shot, aspect, s, size] as const)))(
    '%s in %s: no pop, stop or flicker frame to frame',
    async (_, __, plan, size) => {
      const props = { ...plan.slots, cursor: shotCursor(plan.shot, plan.slots, UI) };
      const diffs = await diffsOf(shotSource(plan.shot, UI), props, plan.seconds, size);

      expect(motionJolts(diffs).map((j) => `${((j.frame + 1) / FPS).toFixed(2)}s ${j.kind}`)).toEqual([]);
    },
    120_000
  );
});
