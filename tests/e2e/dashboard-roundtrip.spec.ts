import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.skip(!REAL_STACK, 'richiede uno stack con utente/org/progetto seminati: E2E_REAL_STACK=1');

test.setTimeout(90_000);

test('signed in: dashboard, open a canvas by URL, back to the dashboard', async ({ page, session }) => {
  await gotoHydrated(page, '/app');
  await expect(page.getByTestId('home-hero')).toBeVisible();

  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  await expect(page.getByTestId('add-bar')).toBeVisible({ timeout: 30_000 });

  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('home-hero')).toBeVisible();
});

test('app routes other than the dashboard and account send back to the dashboard', async ({ page }) => {
  await page.goto('/app/canvases');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('home-hero')).toBeVisible();
});

test('the account menu signs out', async ({ page }) => {
  await gotoHydrated(page, '/app');
  await page.getByTestId('account-menu').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/login/);
});
