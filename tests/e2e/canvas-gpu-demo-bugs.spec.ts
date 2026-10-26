import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK } from './fixtures/session';
import { BUY_BUTTON, LAUNCH, asset, frameDoc, frameHost, launchScene, openCanvas, productCardDoc, seedFrame, solid } from '../../scripts/demo-record/demos/seed';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const TAG = process.env.SHOT_TAG ?? 'after';
const SETTLE_MS = 2500;
const DARK_LUMA = 24;
const BLACK_BOX_SHARE = 0.5;

type Box = { x: number; y: number; width: number; height: number };
type Look = { dark: number; ink: number; chroma: number; green: number };

async function lookAt(page: Page, clip: Box, path?: string): Promise<Look> {
  const png = await page.screenshot({ clip, ...(path ? { path } : {}) });
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = data.length / 3;
  const seen = { dark: 0, ink: 0, chroma: 0, green: 0 };
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    seen.dark += luma < DARK_LUMA ? 1 : 0;
    seen.ink += luma > 200 ? 1 : 0;
    seen.chroma += spread;
    seen.green += g > r + 30 && g > b ? 1 : 0;
  }
  return { dark: seen.dark / px, ink: seen.ink / px, chroma: seen.chroma / px, green: seen.green / px };
}

const within = (frame: Box, part: { x: number; y: number; width: number; height: number }): Box => ({ x: frame.x + (part.x - part.width / 2) * frame.width, y: frame.y + (part.y - part.height / 2) * frame.height, width: part.width * frame.width, height: part.height * frame.height });

test.describe('the GPU canvas draws what the demos show @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 900 } });

  test('a video just combined from scenes is never a black box', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const ids: string[] = [];
    for (const s of LAUNCH) {
      ids.push(await seedFrame(seedNode, admin, session, { x: s.x, y: 80 }, launchScene(s)));
    }
    await openCanvas(page, session);
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(SETTLE_MS);
    const boxes = await Promise.all(ids.map(async (id) => (await frameHost(page, id).boundingBox())!));
    const [left, top] = [Math.min(...boxes.map((b) => b.x)) - 24, Math.min(...boxes.map((b) => b.y)) - 36];
    const [right, bottom] = [Math.max(...boxes.map((b) => b.x + b.width)) + 24, Math.max(...boxes.map((b) => b.y + b.height)) + 24];
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 10 });
    await page.mouse.up();
    await page.mouse.click((left + right) / 2, bottom + 30, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Combine into video' }).click();
    const frames = page.locator('[data-testid="frame-overlays"] [data-frame]');
    await expect.poll(async () => frames.count(), { timeout: 30_000 }).toBe(4);
    const parentId = await frames.evaluateAll((els, seeded) => els.map((e) => e.getAttribute('data-frame')).find((id) => !seeded.includes(id!)), ids);
    let worst = 0;
    for (let i = 0; i < 20; i++) {
      const b = await frameHost(page, parentId!).boundingBox();
      worst = b ? Math.max(worst, (await lookAt(page, b, i === 2 ? `${SHOTS}/gpu-demo-combined-${TAG}.png` : undefined)).dark) : worst;
      await page.waitForTimeout(300);
    }
    expect(worst, 'the combined frame never paints a black box').toBeLessThan(BLACK_BOX_SHARE);
  });

  test('every variant picked in Properties draws on the frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, productCardDoc());
    await openCanvas(page, session);
    await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const frame = (await frameHost(page, id).boundingBox())!;
    const button = within(frame, BUY_BUTTON);
    await page.mouse.click(frame.x + 4, frame.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.getByText(/· buy$/).first().click();
    const variant = page.getByTestId('instance-variant');
    await expect(variant).toBeVisible({ timeout: 15_000 });
    for (const [state, green] of [['Hover', false], ['Done', true], ['Default', false]] as const) {
      await variant.selectOption(state);
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: `${SHOTS}/gpu-demo-variant-${state.toLowerCase()}-${TAG}.png`, clip: frame });
      const seen = await lookAt(page, button);
      expect(seen.dark, `the ${state} button is drawn, not a black hole`).toBeLessThan(0.9);
      expect(seen.green > 0.3, `the ${state} button shows its own colour`).toBe(green);
    }
  });

  test('an image adjustment shows while its slider moves, and zooming a crop out keeps the picture proportions', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const box = { x: 0.27, y: 0.5, width: 0.42, height: 0.86 };
    const doc = frameDoc([
      { id: 'page', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid('#f3efe8') } },
      { id: 'photo', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', ...box, fills: [{ type: 'image', src: asset('/login-visual.webp'), fit: 'cover' }] } }
    ]);
    const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, doc);
    await openCanvas(page, session);
    await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const photo = within((await frameHost(page, id).boundingBox())!, box);
    const centre = { x: photo.x + photo.width / 2, y: photo.y + photo.height / 2 };
    const fill = async () => {
      const rev = await admin.from('motion_revisions').select('doc').eq('node_id', id).order('version', { ascending: false }).limit(1).single();
      return (rev.data!.doc as { tracks: { clips: { props: { fills: { crop?: { w: number; h: number } }[] } }[] }[] }).tracks[0].clips[1].props.fills[0];
    };

    await page.mouse.dblclick(centre.x, centre.y);
    await expect(page.getByTestId('crop-handles')).toBeVisible({ timeout: 15_000 });
    const grip = (await page.getByTestId('crop-grip-top-left').boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 90, grip.y + 50, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await fill()).crop, { timeout: 15_000 }).toBeTruthy();
    const crop = (await fill()).crop!;
    expect(crop.h, 'a cover picture zoomed out stops at the cover window, unstretched').toBeLessThan(0.99);

    const start = await lookAt(page, photo, `${SHOTS}/gpu-demo-adjust-start-${TAG}.png`);
    await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-row').first().click();
    const slider = page.getByTestId('fill-adjust-saturation').locator('input[type="range"]');
    await slider.scrollIntoViewIfNeeded();
    const s = (await slider.boundingBox())!;
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width * 0.05, s.y + s.height / 2, { steps: 20 });
    await page.waitForTimeout(1000);
    const dragging = await lookAt(page, photo, `${SHOTS}/gpu-demo-adjust-dragging-${TAG}.png`);
    await page.mouse.up();
    expect(dragging.chroma, 'the photo loses its colour while the slider is still held').toBeLessThan(start.chroma / 2);
  });

  test('a title that fades in is shown on a canvas at rest', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const title = { x: 0.5, y: 0.45, width: 0.8, height: 0.2 };
    const doc = frameDoc([
      { id: 'page', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid('#0b1b3a') } },
      { id: 'title', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Meet Orbit', size: 0.12, weight: 600, color: '#ffffff', font: 'sans', ...title }, transitionIn: { kind: 'fade', durationInFrames: 20 } },
      { id: 'sub', from: 10, durationInFrames: 140, component: 'Text', props: { text: 'The desk lamp that follows your day.', size: 0.04, color: '#c9d4ea', font: 'sans', x: 0.5, y: 0.62, width: 0.8, height: 0.08 }, transitionIn: { kind: 'slide-up', durationInFrames: 15 } }
    ]);
    const { still: _still, ...video } = doc;
    const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, video);
    await openCanvas(page, session);
    await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS * 2);
    const frame = (await frameHost(page, id).boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/gpu-demo-rest-title-${TAG}.png`, clip: frame });
    expect((await lookAt(page, within(frame, title))).ink, 'the white title is drawn at rest').toBeGreaterThan(0.05);
  });
});
