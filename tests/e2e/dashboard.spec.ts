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

      test('hero first, the session canvas among the recents, the prompt last', async ({ page, session }) => {
        await gotoHydrated(page, '/app');

        await expect(page.getByTestId('home-hero')).toBeVisible();
        const recents = page.getByTestId('home-recents');
        await expect(recents.locator(`[data-testid="canvas-card"][href="/p/${session.projectId}/c/${session.canvasId}"]`)).toBeVisible();
        await expect(page.getByTestId('video-brief')).toBeVisible();

        if (!SHOTS) {
          return;
        }
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-${scheme}-fold.png` });
      });
    });
  }
}
