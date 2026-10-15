import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.skip(!REAL_STACK, 'richiede uno stack con utente/org/progetto seminati: E2E_REAL_STACK=1');

test.setTimeout(60_000);

const MAIN = [
  { name: 'Canvases', path: '/app/canvases' },
  { name: 'Frame templates', path: '/app/templates' },
  { name: 'Tools', path: '/app/tools' }
];

test.describe('a 1440px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('la sidebar è aperta senza clic e le voci navigano', async ({ page, session }) => {
    await gotoHydrated(page, '/app');

    const sidebar = page.getByTestId('app-sidebar').first();
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
    await expect(sidebar.locator(`a[href="/p/${session.projectId}"]`)).toHaveText('E2E project');

    for (const item of MAIN) {
      await sidebar.getByRole('link', { name: item.name }).click();
      await expect(page).toHaveURL(item.path);
      await expect(sidebar.getByRole('link', { name: item.name })).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('a 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('la sidebar sta in un drawer che si apre e si chiude', async ({ page }) => {
    await gotoHydrated(page, '/app');

    await expect(page.getByTestId('app-sidebar')).toBeHidden();

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByTestId('app-sidebar')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });
});
