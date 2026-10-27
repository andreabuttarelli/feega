import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { HERO_PHOTO, frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const FRAME_W = 1920;
const RULER_MID_PX = 8;
const GUIDE_X = 520;
const GUIDE_Y = 610;
const CTA = { x: 96, y: 650, w: 300, h: 76 };
const CTA_PUSH = 110;

test('rulers and guides', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  const at = (x: number, y: number) => ({ x: box.x + x * k, y: box.y + y * k });
  const photo = at(HERO_PHOTO.x + HERO_PHOTO.w / 2, HERO_PHOTO.y + HERO_PHOTO.h / 2);
  const cta = at(CTA.x + CTA.w / 2, CTA.y + CTA.h / 2);

  await recordDemo(page, { slug: 'rulers-guides', title: 'pull guides from the rulers' }, async (d) => {
    await d.click(photo);
    await d.wait(1200);
    await d.click(photo);
    await expect(page.getByTestId('ruler-left')).toBeVisible({ timeout: 15_000 });
    await d.wait(1200);

    await d.drag({ x: box.x - RULER_MID_PX, y: box.y + box.height / 2 }, at(GUIDE_X, 400));
    await expect(page.getByTestId('user-guide')).toHaveCount(1);
    await d.wait(900);

    await d.drag({ x: box.x + box.width / 2, y: box.y - RULER_MID_PX }, at(900, GUIDE_Y));
    await expect(page.getByTestId('user-guide')).toHaveCount(2);
    await d.wait(1200);

    await d.click(cta);
    await d.wait(600);
    await d.drag(cta, { x: cta.x + (CTA_PUSH - 6) * k, y: cta.y });
    await d.wait(1500);

    const vertical = page.locator('[data-testid="user-guide"][data-axis="x"]');
    const grip = { x: box.x + GUIDE_X * k, y: box.y + 120 * k };
    await d.drag(grip, { x: box.x - RULER_MID_PX, y: grip.y });
    await expect(vertical).toHaveCount(0);
    await d.wait(1500);
  });
});
