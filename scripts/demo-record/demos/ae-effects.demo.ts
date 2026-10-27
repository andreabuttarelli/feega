import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import { HERO_PHOTO, frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const FRAME_W = 1920;
const LOOK_MS = 2200;

type Edit = [label: string, value: string];

const EFFECTS: { name: string; edits: Edit[] }[] = [
  { name: 'Twirl', edits: [['Radius', '420'], ['Angle', '200']] },
  { name: 'Radial blur', edits: [['Zoom', '0.35'], ['Spin', '12']] },
  { name: 'Lens blur', edits: [['Radius', '28']] },
  { name: 'Sharpen', edits: [['Amount', '3']] }
];

test('seven new effects', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  const photo = { x: box.x + (HERO_PHOTO.x + HERO_PHOTO.w / 2) * k, y: box.y + (HERO_PHOTO.y + HERO_PHOTO.h / 2) * k };
  const look = { x: box.x + HERO_PHOTO.x * k, y: box.y + HERO_PHOTO.y * k, width: HERO_PHOTO.w * k, height: HERO_PHOTO.h * k };

  const tryEffect = async (d: Demo, effect: (typeof EFFECTS)[number]) => {
    await d.click(page.getByTestId('add-effect'));
    await d.click(page.getByText(effect.name, { exact: true }));
    await d.click(page.getByTestId('effect-open').first());
    for (const [label, value] of effect.edits) {
      const field = page.getByRole('textbox', { name: label, exact: true });
      await d.click(field);
      await d.key('Meta+A');
      await d.type(field, value, { click: false });
      await d.key('Enter');
    }
    await d.look(look, LOOK_MS);
    await d.click(page.getByRole('button', { name: `Remove ${effect.name}` }));
  };

  await recordDemo(page, { slug: 'ae-effects', title: 'new effects' }, async (d) => {
    await d.click({ x: photo.x, y: photo.y });
    await d.wait(1200);
    await d.click({ x: photo.x, y: photo.y });
    await page.getByTestId('add-effect').scrollIntoViewIfNeeded();
    for (const effect of EFFECTS) {
      await tryEffect(d, effect);
    }
  });
});
