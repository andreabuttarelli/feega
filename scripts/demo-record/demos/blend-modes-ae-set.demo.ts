import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { HERO_PHOTO, frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const FRAME_W = 1920;
const FRAME_H = 1080;
const SPAN = 150;
const MODES = ['multiply', 'screen', 'overlay', 'linear-dodge', 'vivid-light', 'hard-mix'];

const wash = {
  id: 'wash',
  from: 0,
  durationInFrames: SPAN,
  component: 'Shape',
  props: { shape: 'rect', x: (HERO_PHOTO.x + HERO_PHOTO.w / 2) / FRAME_W, y: (HERO_PHOTO.y + HERO_PHOTO.h / 2) / FRAME_H, width: HERO_PHOTO.w / FRAME_W, height: HERO_PHOTO.h / FRAME_H, fills: [{ type: 'solid', color: '#ff7a2f', opacity: 1, visible: true, blend: 'normal' }] }
};

test('blend modes', async ({ page, session, admin, seedNode }) => {
  const doc = heroDoc() as { tracks: { clips: object[] }[] };
  doc.tracks[0].clips.push(wash);
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, doc);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  const photo = { x: box.x + HERO_PHOTO.x * k, y: box.y + HERO_PHOTO.y * k, width: HERO_PHOTO.w * k, height: HERO_PHOTO.h * k };
  const centre = { x: photo.x + photo.width / 2, y: photo.y + photo.height / 2 };

  await recordDemo(page, { slug: 'blend-modes-ae-set', title: 'blend modes' }, async (d) => {
    await d.click(centre);
    await d.wait(1200);
    await d.click(centre);
    const select = page.getByTestId('blend-select');
    await expect(select).toBeVisible({ timeout: 15_000 });
    await d.wait(600);
    for (const mode of MODES) {
      await d.select(select, mode, photo);
      await d.wait(1400);
    }
  });
});
