import { test, expect } from '../../../tests/e2e/fixtures/session';
import { gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';

test('connect figma', async ({ page, session }) => {
  await installCursor(page);
  await gotoHydrated(page, `/app/settings/profile`);
  const row = page.getByTestId('connection-figma');
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.scrollIntoViewIfNeeded();

  await recordDemo(page, { slug: 'connect-figma', title: 'connect figma' }, async (d) => {
    await d.wait(3000);
  });
});
