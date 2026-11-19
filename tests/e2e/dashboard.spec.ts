import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.skip(!REAL_STACK, 'richiede uno stack con utente/org/progetto seminati: E2E_REAL_STACK=1');

test.setTimeout(90_000);

const SHOTS = process.env.DASHBOARD_SHOTS_DIR;

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 }
];

for (const scheme of ['light', 'dark'] as const) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} ${scheme}`, () => {
      test.use({ viewport, colorScheme: scheme });

      test('the greeting and the Feega Cloud line, no projects', async ({ page }) => {
        await gotoHydrated(page, '/app');

        await expect(page.getByTestId('home-hero')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Get the extension' })).toBeVisible();
        await expect(page.getByTestId('home-recents')).toHaveCount(0);

        if (!SHOTS) {
          return;
        }
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-${scheme}-fold.png` });
      });
    });
  }
}
