import { chromium } from '@playwright/test';

const SPA = process.argv[2];
const SHOTS = process.argv[3];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${SPA}/app`);
await page.getByTestId('native-login-form').waitFor({ timeout: 30000 });
console.log('signed out lands on', new URL(page.url()).pathname);
await page.screenshot({ path: `${SHOTS}/login-1-form.png` });

await page.locator('input[name="email"]').fill(process.env.E2E_TEST_EMAIL);
await page.locator('input[name="password"]').fill(process.env.E2E_TEST_PASSWORD);
await page.locator('[data-testid="native-login-form"] button[type="submit"]').click();
await page.waitForURL((url) => url.pathname === '/app', { timeout: 30000 });
await page.locator('a[href^="/p/"]').first().waitFor({ timeout: 30000 });
console.log('after sign-in', new URL(page.url()).pathname);
await page.screenshot({ path: `${SHOTS}/login-2-dashboard.png` });

await page.locator('form[action="/auth/signout"]').first().evaluate((form) => form.requestSubmit());
await page.getByTestId('native-login-form').waitFor({ timeout: 30000 });
console.log('after sign-out', new URL(page.url()).pathname);

await page.goto(`${SPA}/app`);
await page.getByTestId('native-login-form').waitFor({ timeout: 30000 });
console.log('still signed out after reload');
await page.route('**/auth/v1/authorize**', (route) => route.abort());
const authorize = page.waitForRequest('**/auth/v1/authorize**');
await page.getByRole('button', { name: /google/i }).click();
console.log('oauth redirect_to', new URL((await authorize).url()).searchParams.get('redirect_to'));
console.log('errors', JSON.stringify(errors));
await browser.close();
