import { test, expect } from '@playwright/test';
import { gotoHydrated } from './fixtures/session';

const AUTHORIZE = '**/auth/v1/authorize**';
const VERIFIER_COOKIE = /-auth-token-code-verifier$/;

test('Google sign-in leaves from the browser with PKCE and comes back to the web callback', async ({ page }) => {
  let authorize: URL | null = null;
  await page.route(AUTHORIZE, (route) => {
    authorize = new URL(route.request().url());
    return route.fulfill({ status: 200, body: 'provider' });
  });

  await gotoHydrated(page, '/login?invite_token=tok&cli_port=9876&cli_state=s');
  const app = new URL(page.url()).origin;
  await page.locator('form[action="?/google"] button').click();
  await expect.poll(() => authorize).not.toBeNull();

  const sent = authorize as unknown as URL;
  expect(sent.searchParams.get('provider')).toBe('google');
  expect(sent.searchParams.get('code_challenge_method')).toBe('s256');

  const back = new URL(sent.searchParams.get('redirect_to')!);
  expect(back.origin).toBe(app);
  expect(back.pathname).toBe('/auth/callback');
  expect(Object.fromEntries(back.searchParams)).toEqual({ cli_port: '9876', cli_state: 's', invite_token: 'tok' });

  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => VERIFIER_COOKIE.test(cookie.name))).toBe(true);
});

test('a provider refusal comes back to the login with the error shown', async ({ page }) => {
  await gotoHydrated(page, '/auth/callback?error=access_denied');

  await expect(page).toHaveURL(/\/login\?error=oauth/);
  await expect(page.getByRole('alert')).toBeVisible();
});
