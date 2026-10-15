import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { test, expect } from '@playwright/test';
import { REAL_STACK } from './fixtures/session';

const DIST = join(process.cwd(), 'apps/native/bundle-dist');
const ORIGIN = 'http://tauri.localhost';
const NATIVE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) FeegaNative/0.1.0';
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

test.skip(!REAL_STACK || !existsSync(DIST), 'needs E2E_REAL_STACK=1 and `FEEGA_API=<base url> npm run build:native`');

test.setTimeout(120_000);

test.use({
  userAgent: NATIVE_UA,
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'] }
});

function bundled(pathname: string): string {
  const direct = join(DIST, decodeURIComponent(pathname));
  if (existsSync(direct) && statSync(direct).isFile()) {
    return direct;
  }
  const index = join(direct, 'index.html');
  return existsSync(index) ? index : join(DIST, 'index.html');
}

test('the bundled dashboard signs in, opens a hosted canvas signed in', async ({ context, page }) => {
  await context.route(`${ORIGIN}/**`, (route) => {
    const file = bundled(new URL(route.request().url()).pathname);
    return route.fulfill({ body: readFileSync(file), headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' } });
  });
  await page.addInitScript(() => localStorage.setItem('feega:tour-seen', '1'));

  await page.goto(`${ORIGIN}/`);
  await expect(page).toHaveURL(`${ORIGIN}/login`);

  await page.getByPlaceholder('you@yourbrand.com').fill(process.env.E2E_TEST_EMAIL ?? '');
  await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByTestId('home-hero')).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).origin).toBe(ORIGIN);

  const card = page.getByTestId('home-recents').getByTestId('canvas-card').first();
  const href = (await card.getAttribute('href'))!;
  await card.click();

  await page.waitForURL((url) => url.origin !== ORIGIN && url.pathname === href, { timeout: 30_000 });
  await expect(page.getByTestId('add-bar')).toBeVisible({ timeout: 60_000 });
});
