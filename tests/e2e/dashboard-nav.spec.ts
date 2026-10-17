import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.skip(!REAL_STACK, 'richiede uno stack con utente/org/progetto seminati: E2E_REAL_STACK=1');

test.setTimeout(90_000);

const CACHED_MS = 200;
const COLD_MS = 1_000;

type Watch = { sidebarReplaced: boolean; fullPageSkeleton: boolean };

async function watchShell(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sidebar = document.querySelector('.app-side [data-testid="app-sidebar"]');
    const watch = { sidebarReplaced: false, fullPageSkeleton: false };
    Object.assign(window, { __shellWatch: watch });
    new MutationObserver(() => {
      if (!sidebar?.isConnected || document.querySelector('.app-side [data-testid="app-sidebar"]') !== sidebar) {
        watch.sidebarReplaced = true;
      }
      if (document.querySelector('[data-testid="app-entry-shimmer"]')) {
        watch.fullPageSkeleton = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function shellWatch(page: Page): Promise<Watch> {
  return page.evaluate(() => (window as unknown as { __shellWatch: Watch }).__shellWatch);
}

async function timedNav(page: Page, link: string, content: string): Promise<number> {
  await page.evaluate((testid) => {
    const timing = { clicked: 0, shown: 0 };
    Object.assign(window, { __navTiming: timing });
    document.addEventListener('click', () => (timing.clicked = performance.now()), { capture: true, once: true });
    const seen = new MutationObserver(() => {
      if (timing.clicked && document.querySelector(`[data-testid="${testid}"]`)) {
        timing.shown = performance.now();
        seen.disconnect();
      }
    });
    seen.observe(document.body, { childList: true, subtree: true });
  }, content);
  await page.getByTestId('app-sidebar').first().getByRole('link', { name: link }).click();
  await expect(page.getByTestId(content)).toBeVisible({ timeout: 15_000 });
  return page.evaluate(() => {
    const { clicked, shown } = (window as unknown as { __navTiming: { clicked: number; shown: number } }).__navTiming;
    return Math.round((shown || performance.now()) - clicked);
  });
}

test('dashboard to canvases keeps the shell and shows content fast', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoHydrated(page, '/app');
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await watchShell(page);

  const cold = await timedNav(page, 'Canvases', 'canvases-list');
  const back = await timedNav(page, 'Dashboard', 'home-hero');
  const cached = await timedNav(page, 'Canvases', 'canvases-list');

  console.log(`dashboard nav: cold canvases ${cold} ms, home ${back} ms, cached canvases ${cached} ms`);
  expect(await shellWatch(page)).toEqual({ sidebarReplaced: false, fullPageSkeleton: false });
  expect(cold).toBeLessThan(COLD_MS);
  expect(Math.max(back, cached)).toBeLessThan(CACHED_MS);
});
