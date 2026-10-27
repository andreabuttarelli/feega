import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { FRAME_CELL, frameHost, heroDoc, openCanvas, packGrid, productCardDoc, seedFrame } from './seed';

const FRAME_COUNT = 2;

test('prototype links', async ({ page, session, admin, seedNode }) => {
  const home = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, heroDoc());
  const product = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, productCardDoc());
  await packGrid(admin, [home, product], FRAME_CELL, FRAME_COUNT, 200);
  await admin.from('nodes').update({ display_name: 'Home' }).eq('id', home);
  await admin.from('nodes').update({ display_name: 'Product page' }).eq('id', product);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, home)).toBeVisible({ timeout: 30_000 });
  await expect(frameHost(page, product)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, home).boundingBox())!;
  const target = (await frameHost(page, product).boundingBox())!;

  await recordDemo(page, { slug: 'prototype-links', title: 'link frames into a prototype' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.wait(1500);
    await d.click(page.getByText('Shape · cta', { exact: true }));
    const section = page.getByTestId('prototype-section');
    await expect(section).toBeVisible({ timeout: 15_000 });
    await d.click(page.getByTestId('prototype-link'));
    await expect(page.getByTestId('prototype-hint')).toBeVisible();
    await d.move({ x: target.x + target.width / 2, y: target.y + target.height / 2 });
    await d.wait(900);
    await d.click({ x: target.x + target.width / 2, y: target.y + target.height / 2 });
    await expect(page.getByTestId('prototype-arrows').locator('.arrow')).toHaveCount(1);
    await d.wait(1500);
    await d.select(page.getByLabel('Transition'), 'Slide in', box);
    await d.wait(800);
    await d.select(page.getByLabel('Direction'), 'From right', box);
    await d.wait(1200);
  });
});
