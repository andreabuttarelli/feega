import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import type { Locator } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import type { Rect } from '../camera';
import { frameDoc, frameHost, openCanvas, seedFrame } from './seed';

const PHOTO = `${process.env.E2E_BASE_URL ?? 'http://localhost:5173'}/login-visual.webp`;
const ZOOM_PX = 90;
const PAN_PX = 50;

async function slide(d: Demo, slider: Locator, share: number, photo: Rect) {
  await slider.scrollIntoViewIfNeeded();
  const b = (await slider.boundingBox())!;
  const y = b.y + b.height / 2;
  await d.drag({ x: b.x + b.width / 2, y }, { x: b.x + b.width * share, y }, undefined, photo);
}

test('image crop and adjustments', async ({ page, session, admin, seedNode }) => {
  const photo = { id: 'photo', from: 0, durationInFrames: 150, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.86, height: 0.86, shape: 'rect', fills: [{ type: 'image', src: PHOTO, fit: 'cover' }] } };
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, frameDoc([photo]));
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const stage = (await frameHost(page, id).boundingBox())!;
  const centre = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };

  await recordDemo(page, { slug: 'image-crop-adjust', title: 'crop and grade images' }, async (d) => {
    await d.click(centre, { double: true });
    await expect(page.getByTestId('crop-handles')).toBeVisible({ timeout: 15_000 });
    await d.wait(500);
    const grip = (await page.getByTestId('crop-grip-top-left').boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    await d.drag(from, { x: from.x + ZOOM_PX, y: from.y + ZOOM_PX * 0.56 });
    const pan = (await page.getByTestId('crop-pan').boundingBox())!;
    const middle = { x: pan.x + pan.width / 2, y: pan.y + pan.height / 2 };
    await d.drag(middle, { x: middle.x - PAN_PX, y: middle.y + PAN_PX / 2 });
    await d.key('Enter', 'Enter');
    await expect(page.getByTestId('crop-handles')).toHaveCount(0);
    await d.wait(800);

    const stack = page.getByTestId('motion-inspector').getByTestId('fill-stack').first();
    await d.click(stack.getByTestId('fill-row').first());
    await slide(d, page.getByTestId('fill-adjust-saturation').locator('input[type="range"]'), 0.85, stage);
    await slide(d, page.getByTestId('fill-adjust-temperature').locator('input[type="range"]'), 0.25, stage);
    await slide(d, page.getByTestId('fill-adjust-contrast').locator('input[type="range"]'), 0.75, stage);
    await d.move(centre);
    await d.wait(1800);
  });
});
