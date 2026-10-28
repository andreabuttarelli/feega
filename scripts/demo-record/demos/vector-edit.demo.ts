import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { block, frameDoc, frameHost, openCanvas, seedFrame, solid, words } from './seed';

const FRAME_W = 1920;
const FRAME_H = 1080;
const SHOTS = `${process.env.FEEGA_VIDEOS_DIR ?? `${process.env.HOME}/feega-videos-tmp`}/demos`;
const BLOB = { x: 1060, y: 260, w: 560, h: 560 };

const poster = () =>
  frameDoc([
    block('ground', { x: 0, y: 0, w: FRAME_W, h: FRAME_H }, '#f3efe6'),
    words('title', 'soft edges', { x: 140, y: 380, w: 760, h: 200 }, 140, '#141414'),
    words('kicker', 'spring collection — 2027', { x: 146, y: 600, w: 700, h: 60 }, 36, '#6b6457'),
    { id: 'blob', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: (BLOB.x + BLOB.w / 2) / FRAME_W, y: (BLOB.y + BLOB.h / 2) / FRAME_H, width: BLOB.w / FRAME_W, height: BLOB.h / FRAME_H, fills: solid('#ff6a3d') } }
  ]);

const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test('vector edit mode', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, poster());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  const blob = { x: box.x + (BLOB.x + BLOB.w / 2) * k, y: box.y + (BLOB.y + BLOB.h / 2) * k };

  await recordDemo(page, { slug: 'vector-edit', title: 'edit any shape point by point' }, async (d) => {
    await d.click(blob);
    await d.wait(1200);
    await d.click(blob);
    await d.wait(800);
    await d.click(blob, { double: true });
    const overlay = page.getByTestId('pen-overlay');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await d.wait(800);
    await page.screenshot({ path: `${SHOTS}/vector-edit-1-enter.png` });

    const points = overlay.locator('.point');
    const from = centre((await points.nth(1).boundingBox())!);
    await d.drag(from, { x: from.x + 120 * k, y: from.y - 80 * k });
    await d.wait(600);
    await page.screenshot({ path: `${SHOTS}/vector-edit-2-drag-point.png` });

    await d.click(points.nth(2), { double: true });
    await d.wait(800);
    const handle = overlay.locator('.handle').first();
    await expect(handle).toBeVisible({ timeout: 5000 });
    const at = centre((await handle.boundingBox())!);
    await d.drag(at, { x: at.x + 200 * k, y: at.y + 120 * k });
    await d.wait(800);
    await page.screenshot({ path: `${SHOTS}/vector-edit-3-drag-handle.png` });

    await d.key('Enter', 'Enter');
    await expect(overlay).toHaveCount(0);
    await d.wait(1500);
  });
});
