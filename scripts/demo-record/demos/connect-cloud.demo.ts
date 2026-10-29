import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

test('connect cloud', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);

  await recordDemo(page, { slug: 'connect-cloud', title: 'import from drive or dropbox' }, async (d) => {
    await d.click(page.getByTestId('insert-open'));
    await d.click(page.getByTestId('insert-menu').locator('[data-insert="cloud"]'));
    await expect(page.getByTestId('cloud-picker')).toBeVisible();
    await expect(page.getByTestId('cloud-connect')).toBeVisible({ timeout: 30_000 });
    await d.wait(1800);
    await d.click(page.getByTestId('cloud-tab-dropbox'));
    await expect(page.getByTestId('cloud-connect')).toContainText('Dropbox');
    await d.wait(1800);
    await d.click(page.getByTestId('cloud-tab-google_drive'));
    await d.wait(1500);
  });
});
