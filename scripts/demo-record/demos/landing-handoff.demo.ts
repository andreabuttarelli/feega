import { test, expect, gotoHydrated, dismissCookieBanner } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { dropStarted, holdAgent, projectOf, startedCanvas } from './home-helpers';

const TEST_MS = 1_200_000;
const READ_MS = 2400;
const SCREEN = { x: 0, y: 0, width: 1600, height: 900 };
const LANDING = process.env.DEMO_LANDING_URL ?? 'http://localhost:5198';
const APP = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const PROD_APP = /^https:\/\/oh\.feega\.app\//;
const HTTP_FOUND = 302;
const BRIEF = 'A 15 second launch film for Ember & Rain, a coffee bar in Leith opening on 1 December. Warm amber light, rain on glass, the logo, then the address.';

test('landing handoff', async ({ page, context, session, admin }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  const release = await holdAgent(page);
  await context.clearCookies();
  await page.route(PROD_APP, (route) => route.fulfill({ status: HTTP_FOUND, headers: { location: route.request().url().replace(PROD_APP, `${APP}/`) } }));
  await page.goto(LANDING, { waitUntil: 'networkidle' });
  const hero = page.getByTestId('hero-prompt');
  await expect(hero).toBeVisible();

  let started: string | null = null;
  try {
    await recordDemo(page, { slug: 'landing-handoff', title: 'type it on the homepage' }, async (d) => {
      await d.look(SCREEN, READ_MS);
      await d.type(hero.locator('textarea'), BRIEF);
      await d.click(hero.locator('button[type="submit"]'));

      await d.skip(async () => {
        await page.waitForURL(/\/login/);
        await gotoHydrated(page, '/login');
        await dismissCookieBanner(page);
      });
      await d.type(page.getByPlaceholder('you@yourbrand.com'), session.email);
      await d.type(page.locator('input[type="password"]'), session.password);
      await d.click(page.getByRole('button', { name: 'Sign in', exact: true }));

      await d.skip(() => startedCanvas(page));
      started = projectOf(page.url());
      await d.look(SCREEN, READ_MS * 2);
    });
  } finally {
    release();
    await dropStarted(admin, session, started ?? projectOf(page.url()));
  }
});
