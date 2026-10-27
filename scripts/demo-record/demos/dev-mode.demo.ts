import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const FRAME_W = 1920;
const FRAME_H = 1080;
const BUTTON = { x: 96, y: 650, w: 300, h: 76 };
const HEADLINE = { x: 96, y: 300, w: 820, h: 200 };
const READ_MS = 2600;

const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

test('dev mode', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  expect(box.height / FRAME_H).toBeCloseTo(k, 1);
  const onScreen = (b: typeof BUTTON) => ({ x: box.x + centre(b).x * k, y: box.y + centre(b).y * k });

  await recordDemo(page, { slug: 'dev-mode', title: 'read any layer as code' }, async (d) => {
    await d.click(onScreen(BUTTON));
    await d.wait(1500);
    await d.click(onScreen(BUTTON));
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });

    await d.key('Shift+D', '⇧D');
    const inspector = page.getByTestId('dev-inspector');
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await d.look((await inspector.boundingBox())!, READ_MS);

    await d.click(page.getByTestId('dev-copy-css'));
    await d.move(onScreen(HEADLINE));
    await expect(page.getByTestId('frame-measure-label').first()).toBeVisible({ timeout: 10_000 });
    await d.wait(READ_MS);

    await d.click(page.getByTestId('dev-copy-tailwind'));
    await d.look((await inspector.boundingBox())!, READ_MS);

    await d.click(page.getByTestId('dev-export'));
    await expect(page.getByTestId('export-dialog')).toBeVisible({ timeout: 10_000 });
    await d.wait(READ_MS);
    await d.key('Escape');

    await d.click(page.getByTestId('dev-toggle'));
    await d.wait(1200);
  });
});
