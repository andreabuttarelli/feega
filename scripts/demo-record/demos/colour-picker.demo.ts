import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const FRAME_W = 1920;
const PAGE_SPOT = { x: 1500, y: 880 };
const SAMPLED = '#c8553d';
const SQUARE_FROM = { x: 0.55, y: 0.6 };
const SQUARE_TO = { x: 0.85, y: 0.3 };
const HUE_TO = 0.38;

async function stubEyedropper(page: import('@playwright/test').Page) {
  await page.addInitScript((hex) => {
    (window as unknown as { EyeDropper: unknown }).EyeDropper = class {
      open() {
        return Promise.resolve({ sRGBHex: hex });
      }
    };
  }, SAMPLED);
}

test('colour picker', async ({ page, session, admin, seedNode }) => {
  await stubEyedropper(page);
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  const button = { x: box.x + PAGE_SPOT.x * k, y: box.y + PAGE_SPOT.y * k };

  await recordDemo(page, { slug: 'figma-colour-picker', title: 'a real colour picker' }, async (d) => {
    await d.click(button);
    await d.wait(1200);
    await d.click(button);
    const stack = page.getByTestId('motion-inspector').getByTestId('fill-stack').first();
    await expect(stack.getByTestId('fill-row').first()).toBeVisible({ timeout: 15_000 });
    await d.wait(500);
    await d.click(stack.getByTestId('fill-row').first().getByTestId('fill-swatch'));

    const editor = page.getByTestId('fill-editor');
    const square = editor.getByTestId('colour-square');
    await expect(square).toBeVisible({ timeout: 15_000 });
    await d.wait(700);
    const area = (await square.boundingBox())!;
    const at = (p: { x: number; y: number }) => ({ x: area.x + area.width * p.x, y: area.y + area.height * p.y });
    await d.drag(at(SQUARE_FROM), at(SQUARE_TO), undefined, area);

    const hue = (await editor.getByTestId('colour-hue').boundingBox())!;
    const hueY = hue.y + hue.height / 2;
    await d.drag({ x: hue.x + hue.width * 0.05, y: hueY }, { x: hue.x + hue.width * HUE_TO, y: hueY }, undefined, area);
    await d.wait(500);

    await d.select(editor.getByTestId('colour-format'), 'rgb');
    await d.wait(500);
    const red = editor.getByTestId('colour-channel').first();
    await d.move(red);
    await red.focus();
    await red.selectText();
    await d.type(red, '240', { click: false });
    await d.key('Enter');
    await d.wait(700);

    await d.click(editor.getByTestId('colour-eyedropper'));
    await d.wait(900);

    await d.click(editor.locator('.swatch').nth(1));
    await d.wait(1600);
  });
});
