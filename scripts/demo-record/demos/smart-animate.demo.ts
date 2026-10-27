import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { FRAME_CELL, SETTLE_MS, frameDoc, frameHost, openCanvas, packGrid, seedFrame, solid } from './seed';

const FRAME_COUNT = 2;
const W = 1920;
const H = 1080;
const SPAN = 150;

type Box = { x: number; y: number; w: number; h: number };

const frac = (b: Box) => ({ x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H, width: b.w / W, height: b.h / H });
const shape = (id: string, b: Box, color: string, roundness = 0) => ({ id, from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', roundness, ...frac(b), fills: solid(color) } });
const words = (id: string, text: string, b: Box, px: number, color: string) => ({ id, from: 0, durationInFrames: SPAN, component: 'Text', props: { text, size: px / H, ...frac(b), color, font: 'sans' } });

const listDoc = () =>
  frameDoc([
    shape('page', { x: 0, y: 0, w: W, h: H }, '#f6f1ea'),
    shape('card', { x: 96, y: 120, w: 1728, h: 260 }, '#ffffff', 0.12),
    shape('thumb', { x: 130, y: 150, w: 200, h: 200 }, '#d9b99b', 0.2),
    words('title', 'Morning Mug', { x: 380, y: 170, w: 700, h: 80 }, 56, '#1d1a16'),
    words('price', '€24', { x: 380, y: 270, w: 300, h: 60 }, 40, '#5b544b'),
    shape('cta', { x: 1440, y: 190, w: 340, h: 120 }, '#1d1a16', 0.5)
  ]);

const detailDoc = () =>
  frameDoc([
    shape('page', { x: 0, y: 0, w: W, h: H }, '#f6f1ea'),
    shape('card', { x: 96, y: 96, w: 1728, h: 888 }, '#ffffff', 0.05),
    shape('thumb', { x: 150, y: 150, w: 780, h: 780 }, '#d9b99b', 0.06),
    words('title', 'Morning Mug', { x: 1010, y: 260, w: 760, h: 140 }, 104, '#1d1a16'),
    words('price', '€24', { x: 1010, y: 440, w: 300, h: 100 }, 72, '#5b544b'),
    shape('cta', { x: 1010, y: 700, w: 700, h: 150 }, '#2f7d4f', 0.5)
  ]);

test('smart animate', async ({ page, session, admin, seedNode }) => {
  const list = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, listDoc());
  const detail = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, detailDoc());
  await packGrid(admin, [list, detail], FRAME_CELL, FRAME_COUNT, 200);
  await admin.from('nodes').update({ display_name: 'Mug list' }).eq('id', list);
  await admin.from('nodes').update({ display_name: 'Mug detail' }).eq('id', detail);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, list)).toBeVisible({ timeout: 30_000 });
  await expect(frameHost(page, detail)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
  const box = (await frameHost(page, list).boundingBox())!;
  const target = (await frameHost(page, detail).boundingBox())!;

  await recordDemo(page, { slug: 'smart-animate', title: 'smart animate between frames' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.wait(1500);
    await d.click(page.getByText('Shape · cta', { exact: true }));
    await expect(page.getByTestId('prototype-section')).toBeVisible({ timeout: 15_000 });
    await d.click(page.getByTestId('prototype-link'));
    await d.move({ x: target.x + target.width / 2, y: target.y + target.height / 2 });
    await d.wait(900);
    await d.click({ x: target.x + target.width / 2, y: target.y + target.height / 2 });
    await expect(page.getByTestId('prototype-arrows').locator('.arrow')).toHaveCount(1);
    await d.wait(1200);
    await d.select(page.getByLabel('Transition'), 'Smart animate', box);
    await expect(page.getByTestId('smart-animate-preview')).toBeVisible();
    await d.wait(1000);
    await d.click(page.getByTestId('smart-animate-play'));
    await d.wait(1200);
    await d.click(page.getByTestId('smart-animate-play'));
    await d.wait(1500);
  });
});
