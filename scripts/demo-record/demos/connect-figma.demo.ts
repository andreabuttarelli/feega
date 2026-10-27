import { test, expect } from '../../../tests/e2e/fixtures/session';
import { gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';

const DUMMY_SECRET = 'xxxxxxxxxxxxxxxxxxxxxxxx';

test('connect figma', async ({ page, session }) => {
  await installCursor(page);
  await gotoHydrated(page, `/p/${session.projectId}/settings/profile`);
  const form = page.getByTestId('figma-token-form');
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.scrollIntoViewIfNeeded();

  await recordDemo(page, { slug: 'connect-figma', title: 'connect figma' }, async (d) => {
    await d.wait(1200);
    await d.type(form.locator('input[name="token"]'), DUMMY_SECRET);
    await d.wait(1800);
  });
});
