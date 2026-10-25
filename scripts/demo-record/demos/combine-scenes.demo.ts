import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { LAUNCH, frameHost, launchScene, FRAME_CELL, openCanvas, packGrid, seedFrame } from './seed';

const PLAY_MS = 6500;

test('combine scenes into one video', async ({ page, session, admin, seedNode }) => {
  const ids: string[] = [];
  for (const s of LAUNCH) {
    ids.push(await seedFrame(seedNode, admin, session, { x: 0, y: 80 }, launchScene(s)));
  }
  await packGrid(admin, ids, FRAME_CELL);
  await installCursor(page);
  await openCanvas(page, session);
  const boxes = await Promise.all(ids.map(async (id) => (await frameHost(page, id).boundingBox())!));
  const left = Math.min(...boxes.map((b) => b.x)) - 24;
  const top = Math.min(...boxes.map((b) => b.y)) - 36;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + 24;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 24;

  await recordDemo(page, { slug: 'combine-scenes', title: 'combine scenes into one video' }, async (d) => {
    await d.drag({ x: left, y: top }, { x: right, y: bottom });
    await d.click({ x: (left + right) / 2, y: bottom + 30 }, { button: 'right' });
    await d.click(page.getByRole('menuitem', { name: 'Combine into video' }));
    await expect.poll(async () => page.locator('[data-testid="frame-overlays"] [data-frame]').count(), { timeout: 30_000 }).toBe(4);
    await d.wait(1200);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(1500);
    const parentId = await page.locator('[data-testid="frame-overlays"] [data-frame]').evaluateAll((els, seeded) => els.map((e) => e.getAttribute('data-frame')).find((id) => !seeded.includes(id!)), ids);
    const parent = frameHost(page, parentId!);
    const small = (await parent.boundingBox())!;
    await d.click({ x: small.x + small.width / 2, y: small.y + small.height / 2 });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await d.key('Shift+Digit2', '⇧ 2');
    await d.wait(1200);
    const box = (await parent.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.move({ x: box.x + box.width + 40, y: centre.y });
    await d.look({ x: box.x, y: box.y, width: box.width, height: box.height }, PLAY_MS);
  });
});
