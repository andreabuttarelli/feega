import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.skip(!REAL_STACK, 'richiede uno stack con utente/org/progetto seminati: E2E_REAL_STACK=1');

test.setTimeout(90_000);

const CACHED_NAV_MS = 200;

async function timed(run: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await run();
  return Date.now() - start;
}

test('signed in: dashboard, open a canvas, back to the dashboard', async ({ page, session }) => {
  await gotoHydrated(page, '/app');

  const card = page.getByTestId('home-recents').locator(`[data-testid="canvas-card"][href="/p/${session.projectId}/c/${session.canvasId}"]`);
  await card.click();

  await expect(page).toHaveURL(new RegExp(`/p/${session.projectId}/c/${session.canvasId}`));
  await expect(page.getByTestId('add-bar')).toBeVisible({ timeout: 30_000 });

  await page.goBack();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('home-recents').getByTestId('canvas-card').first()).toBeVisible();
});

test('a dashboard page already seen opens from cache', async ({ page }) => {
  const sidebar = page.getByTestId('app-sidebar').first();
  await gotoHydrated(page, '/app');
  await sidebar.getByRole('link', { name: 'Canvases' }).click();
  await expect(page.getByTestId('canvases-list')).toBeVisible();
  await sidebar.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('home-hero')).toBeVisible();

  const toCanvases = await timed(async () => {
    await sidebar.getByRole('link', { name: 'Canvases' }).click();
    await expect(page.getByTestId('canvases-list')).toBeVisible();
  });
  const toHome = await timed(async () => {
    await sidebar.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('home-hero')).toBeVisible();
  });

  console.log(`cached nav: canvases ${toCanvases} ms, home ${toHome} ms`);
  expect(Math.max(toCanvases, toHome)).toBeLessThan(CACHED_NAV_MS);
});

test('new project from the sidebar opens its first canvas', async ({ page, admin }) => {
  await gotoHydrated(page, '/app');
  await page.getByTestId('app-sidebar').first().getByTestId('app-sidebar-new-project').click();

  await page.waitForURL(/\/p\/[0-9a-f-]+\/c\/[0-9a-f-]+/);
  const projectId = new URL(page.url()).pathname.split('/')[2];
  try {
    await expect(page.getByTestId('add-bar')).toBeVisible({ timeout: 30_000 });
  } finally {
    await admin.from('canvases').delete().eq('project_id', projectId);
    await admin.from('projects').delete().eq('id', projectId);
  }
});
