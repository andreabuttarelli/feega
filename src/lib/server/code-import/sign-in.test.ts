import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }));

import { DEFAULT_SUBMIT_SELECTOR } from '$lib/server/web/app-browse';
import type { AppTab, SessionCookie } from '$lib/server/web/browser';
import { Gate, Locked, lockedOut, lockedRoute, signedIn } from './sign-in';

const SANDBOX = 'https://sb-1.vercel.run';
const PASSWORD = 'fake-test-password';
const ACCOUNT = { loginUrl: 'https://app.acme.example/login?next=%2F', email: 'qa@acme.example', password: PASSWORD };
const COOKIE: SessionCookie = { name: 'sid', value: 'abc', domain: 'sb-1.vercel.run', path: '/', expires: -1, httpOnly: true, secure: true };

function appTab(opts: { loginWorks?: boolean; passwordField?: boolean; landsAt?: string } = {}) {
  let at = 'about:blank';
  let cookies: SessionCookie[] = [];
  const typed: string[] = [];
  const tab = {
    typed,
    goto: vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      at = !cookies.length && path !== '/login' ? `${SANDBOX}/login` : url;
      return 200;
    }),
    url: () => opts.landsAt ?? at,
    waitFor: vi.fn(async (selector: string) => {
      if (selector.includes('password') && opts.passwordField === false) {
        throw new Error('no field');
      }
    }),
    type: vi.fn(async (_selector: string, text: string) => {
      typed.push(text);
    }),
    click: vi.fn(async (target: { selector?: string }) => {
      if (target.selector === DEFAULT_SUBMIT_SELECTOR && opts.loginWorks !== false) {
        cookies = [COOKIE];
        at = `${SANDBOX}/dashboard`;
      }
    }),
    session: vi.fn(async () => ({ cookies, storage: {} })),
    restore: vi.fn(async () => undefined),
    label: vi.fn(async () => ''),
    shot: vi.fn(async () => Buffer.from('jpeg')),
    ui: vi.fn(async () => ({ title: '', elements: [] })),
    overlay: vi.fn(async () => null),
    press: vi.fn(async () => undefined),
    close: vi.fn(async () => 0)
  };
  return tab as unknown as AppTab & typeof tab;
}

describe('lockedOut', () => {
  it('a route that lands on the login path of the account is locked', async () => {
    const tab = appTab({ landsAt: `${SANDBOX}/auth/enter?from=%2Fbilling` });

    expect(await lockedOut(tab, `${SANDBOX}/billing`, `${SANDBOX}/auth/enter`)).toBe(true);
  });

  it('without an account, a sign-in path is enough', async () => {
    const tab = appTab({ landsAt: `${SANDBOX}/sign-in` });

    expect(await lockedOut(tab, `${SANDBOX}/billing`, null)).toBe(true);
  });

  it('a redirect to any page with a password field is locked', async () => {
    const tab = appTab({ landsAt: `${SANDBOX}/welcome` });

    expect(await lockedOut(tab, `${SANDBOX}/billing`, null)).toBe(true);
  });

  it('a redirect to a page without a password field is not', async () => {
    const tab = appTab({ landsAt: `${SANDBOX}/en/billing-v2`, passwordField: false });

    expect(await lockedOut(tab, `${SANDBOX}/billing`, null)).toBe(false);
  });

  it('a route that stays where it was asked is never locked, even the login page itself', async () => {
    expect(await lockedOut(appTab({ landsAt: `${SANDBOX}/login/` }), `${SANDBOX}/login`, `${SANDBOX}/login`)).toBe(false);
  });
});

describe('signedIn', () => {
  it('without a test account there is nothing to sign in with', async () => {
    const open = vi.fn();

    expect(await signedIn(open, null, `${SANDBOX}/`)).toEqual({ gate: Gate.None });
    expect(open).not.toHaveBeenCalled();
  });

  it('signs in on the login PATH of the account, on the origin of the app under import', async () => {
    const tab = appTab();

    const done = await signedIn(async () => tab, ACCOUNT, `${SANDBOX}/`, async () => undefined);

    expect(tab.goto).toHaveBeenCalledWith(`${SANDBOX}/login?next=%2F`);
    expect(tab.typed).toEqual([ACCOUNT.email, PASSWORD]);
    expect(done).toEqual({ gate: Gate.Signed, loginUrl: `${SANDBOX}/login?next=%2F`, session: { cookies: [COOKIE], storage: {} } });
  });

  it('a refused login carries the reason, never the password', async () => {
    const tab = appTab({ loginWorks: false });

    const done = await signedIn(async () => tab, ACCOUNT, `${SANDBOX}/`, async () => undefined);

    expect(done.gate).toBe(Gate.Failed);
    expect(JSON.stringify(done)).toContain('still on the sign-in page');
    expect(JSON.stringify(done)).not.toContain(PASSWORD);
  });
});

describe('lockedRoute', () => {
  it('says why for each way the sign-in went', () => {
    expect(lockedRoute('/billing', { gate: Gate.None })).toEqual({ label: '/billing', reason: Locked.NoAccount });
    expect(lockedRoute('/billing', { gate: Gate.Failed, loginUrl: SANDBOX, error: 'login failed: x' })).toEqual({ label: '/billing', reason: Locked.SignInFailed, detail: 'login failed: x' });
    expect(lockedRoute('/billing', { gate: Gate.Signed, loginUrl: SANDBOX, session: { cookies: [], storage: {} } })).toEqual({ label: '/billing', reason: Locked.StillLocked });
  });
});
