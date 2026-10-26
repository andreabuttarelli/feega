import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { productCardDoc, BUY_BUTTON, frameHost, openCanvas, seedFrame } from './seed';

test('component variants', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, productCardDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const button = { x: box.x + BUY_BUTTON.x * box.width, y: box.y + BUY_BUTTON.y * box.height };

  await recordDemo(page, { slug: 'component-variants', title: 'variants for components' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.wait(2000);
    await d.click(page.getByText(/· buy$/).first());
    const variant = page.getByTestId('instance-variant');
    await expect(variant).toBeVisible({ timeout: 15_000 });
    for (const state of ['Hover', 'Done', 'Default']) {
      await d.select(variant, state, box);
      await d.move(button);
      await d.wait(1400);
    }
  });
});
