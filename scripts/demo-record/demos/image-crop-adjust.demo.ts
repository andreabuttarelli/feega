import type { Locator } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import type { Rect } from '../camera';
import { asset, frameDoc, frameHost, openCanvas, seedFrame, solid } from './seed';

const PHOTO_BOX = { x: 0.27, y: 0.5, width: 0.42, height: 0.86 };
const words = (id: string, text: string, y: number, size: number, color: string, weight = 400) => ({ id, from: 0, durationInFrames: 150, component: 'Text', props: { text, size, weight, color, font: 'sans', x: 0.73, y, width: 0.42, height: size * 1.6 } });
const POST = [
  { id: 'page', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid('#f3efe8') } },
  { id: 'photo', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', ...PHOTO_BOX, fills: [{ type: 'image', src: asset('/login-visual.webp'), fit: 'cover' }] } },
  words('brand', 'Atelier Nord', 0.2, 0.03, '#6b6259', 600),
  words('title', 'The Ochre Blazer', 0.36, 0.075, '#1d1a16', 600),
  words('sub', 'Tailored in wool, made in Lisbon.', 0.5, 0.032, '#5b544b'),
  { id: 'tag', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', roundness: 0.5, x: 0.6, y: 0.68, width: 0.16, height: 0.1, fills: solid('#1d1a16') } },
  { id: 'price', from: 0, durationInFrames: 150, component: 'Text', props: { text: '€189', size: 0.045, weight: 600, color: '#ffffff', font: 'sans', x: 0.6, y: 0.68, width: 0.16, height: 0.08, align: 'center' } }
];
const ZOOM_PX = 90;
const PAN_PX = 50;

async function slide(d: Demo, slider: Locator, share: number, photo: Rect) {
  await slider.scrollIntoViewIfNeeded();
  const b = (await slider.boundingBox())!;
  const y = b.y + b.height / 2;
  await d.drag({ x: b.x + b.width / 2, y }, { x: b.x + b.width * share, y }, undefined, photo);
}

test('image crop and adjustments', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, frameDoc(POST));
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const frame = (await frameHost(page, id).boundingBox())!;
  const stage = { x: frame.x + (PHOTO_BOX.x - PHOTO_BOX.width / 2) * frame.width, y: frame.y + (PHOTO_BOX.y - PHOTO_BOX.height / 2) * frame.height, width: PHOTO_BOX.width * frame.width, height: PHOTO_BOX.height * frame.height };
  const centre = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };

  await recordDemo(page, { slug: 'image-crop-adjust', title: 'crop and grade images' }, async (d) => {
    await d.click(centre, { double: true });
    await expect(page.getByTestId('crop-handles')).toBeVisible({ timeout: 15_000 });
    await d.wait(500);
    const grip = (await page.getByTestId('crop-grip-top-left').boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    await d.drag(from, { x: from.x - ZOOM_PX, y: from.y - ZOOM_PX * 0.56 });
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
