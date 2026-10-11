import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import type { VectorUi } from '../vector-ui/model';
import { ShotId, shotSource } from './library';
import { shotCursor } from './ops';
import { FILL_MIN, uiCoverage } from './coverage';
import FEEGA_APP from './fixtures/feega-app-vector.json';

const UI = FEEGA_APP as unknown as VectorUi;
const ASPECTS = { '9:16': { width: 1080, height: 1920 }, '16:9': { width: 1920, height: 1080 }, '1:1': { width: 1080, height: 1080 } };
const SAMPLES = 12;
const AGREEMENT = 0.1;
const SHOTS: { shot: ShotId; seconds: number; slots: Record<string, unknown> }[] = [
  { shot: ShotId.UiFocus, seconds: 4, slots: { field_id: 'input-0', button_id: 'button-5', type_text: 'a launch film for feega' } },
  { shot: ShotId.UiMorph, seconds: 3, slots: { from_id: 'button-7', to_id: 'button-9' } },
  { shot: ShotId.WhipZoom, seconds: 1.4, slots: { target_id: 'button-5' } },
  { shot: ShotId.DeviceFlyIn, seconds: 4, slots: {} }
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
window.drawnShare = () => {
  const r = document.querySelector('.vui').getBoundingClientRect();
  const W = root.clientWidth;
  const H = root.clientHeight;
  const w = Math.max(0, Math.min(W, r.right) - Math.max(0, r.left));
  const h = Math.max(0, Math.min(H, r.bottom) - Math.max(0, r.top));
  return (w * h) / (W * H);
};
window.paper = () => getComputedStyle(root).backgroundColor;
`;

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

type Drawn = { t: number; share: number }[];

async function drawn(plan: (typeof SHOTS)[number], size: { width: number; height: number }): Promise<{ shares: Drawn; paper: string }> {
  const page = await browser.newPage({ viewport: size });
  const source = shotSource(plan.shot, UI);
  const props = { ...plan.slots, ...(plan.shot === ShotId.UiFocus || plan.shot === ShotId.UiMorph ? { cursor: shotCursor(plan.shot, plan.slots, UI) } : {}) };
  await page.setContent(`<html><head><style>${source.css}</style></head><body style="margin:0"><div id="root" style="position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden"></div></body></html>`);
  await page.addScriptTag({ content: STAGE(source.js, props, plan.seconds) });
  const shares: Drawn = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = ((i + 0.5) / SAMPLES) * plan.seconds;
    await page.evaluate((at) => (window as unknown as { seekTo: (t: number) => void }).seekTo(at), t);
    shares.push({ t, share: await page.evaluate(() => (window as unknown as { drawnShare: () => number }).drawnShare()) });
  }
  const paper = await page.evaluate(() => (window as unknown as { paper: () => string }).paper());
  await page.close();
  return { shares, paper };
}

const filled = (shares: Drawn) => shares.filter((s) => s.share >= FILL_MIN).length / shares.length;

const CASES = SHOTS.flatMap((s) => Object.entries(ASPECTS).map(([aspect, size]) => [s.shot, aspect, s, size] as const));

describe('the app fills the frame, measured on what the browser draws', () => {
  it.each(CASES)('%s in %s: the coverage model agrees with the drawn screen', async (_, __, plan, size) => {
    const { shares } = await drawn(plan, size);

    shares.forEach((s) => expect(Math.abs(uiCoverage(plan.shot, UI, size, s.t, plan.seconds) - s.share), `t=${s.t.toFixed(2)}`).toBeLessThan(AGREEMENT));
  }, 60_000);

  it.each(CASES.filter(([shot]) => shot !== ShotId.DeviceFlyIn))('%s in %s covers at least 60% of the frame most of the time', async (_, __, plan, size) => {
    const { shares } = await drawn(plan, size);

    expect(filled(shares)).toBeGreaterThan(0.5);
  }, 60_000);

  it('device-fly-in in 9:16 zooms into the screen after landing', async () => {
    const { shares } = await drawn(SHOTS[3], ASPECTS['9:16']);

    expect(shares[shares.length - 1].share).toBeGreaterThan(0.95);
  }, 60_000);

  it.each(CASES)('%s in %s sits on the app own background, not black', async (_, __, plan, size) => {
    const { paper } = await drawn(plan, size);

    expect(paper).toBe('rgb(249, 249, 249)');
  }, 60_000);
});
