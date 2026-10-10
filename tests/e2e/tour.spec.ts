import { test as base, expect } from '@playwright/test';
import { E2eTour, REAL_STACK, createE2eSession, gotoHydrated, signInE2e, teardownE2eSession } from './fixtures/session';

base.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
base.setTimeout(60_000);

base('al primo accesso il tour si apre, si sfoglia, si chiude e non torna', async ({ page }) => {
  const session = await createE2eSession({ tour: E2eTour.Due });
  try {
    await signInE2e(page, session, E2eTour.Due);
    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible();
    await expect(tour).toHaveAttribute('data-slide', 'intro');

    await page.keyboard.press('ArrowRight');
    await expect(tour).toHaveAttribute('data-slide', 'motion');

    const saved = page.waitForResponse((r) => r.url().includes('/api/onboarding-tour'));
    await page.keyboard.press('Escape');
    await saved;
    await expect(tour).toBeHidden();

    await gotoHydrated(page, '/app');
    await expect(tour).toBeHidden();

    await page.getByTestId('open-tour').first().click();
    await expect(tour).toBeVisible();
  } finally {
    await teardownE2eSession(session);
  }
});
