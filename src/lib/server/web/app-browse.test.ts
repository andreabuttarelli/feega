import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import { lookup } from 'node:dns/promises';
import { APP_MAX_SHOTS, APP_SESSION_TTL_MS, DEFAULT_SUBMIT_SELECTOR, appBrowse, destructiveWord, type AppAccount, type AppAccountStore } from './app-browse';
import { StepKind } from './browse';
import type { AppSession, AppTab, SessionCookie } from './browser';

const APP = 'https://app.example';
const LOGIN = `${APP}/login`;
const NOW = 1_000_000;
const COOKIE: SessionCookie = { name: 'sid', value: 'abc', domain: 'app.example', path: '/', expires: -1, httpOnly: true, secure: true };
const SESSION: AppSession = { cookies: [COOKIE], storage: { jwt: 'tok' } };
const UI = { title: 'Dashboard', elements: [{ tag: 'h1', text: 'Overview', x: 0, y: 0, w: 100, h: 20 }] };

type Fake = AppTab & { typed: [string, string][] };

function fakeTab(opts: { loginWorks?: boolean; sessionAlive?: boolean; labels?: Record<string, string> } = {}): Fake {
  const { loginWorks = true, sessionAlive = true, labels = {} } = opts;
  let at = 'about:blank';
  let cookies: SessionCookie[] = [];
  const kept = (): AppSession => ({ cookies, storage: cookies.length ? { jwt: 'tok' } : {} });
  const typed: [string, string][] = [];
  const tab: Fake = {
    typed,
    goto: vi.fn(async (url: string) => {
      const loggedIn = cookies.length > 0;
      at = !loggedIn && url !== LOGIN ? LOGIN : url;
      return 200;
    }),
    url: () => at,
    html: vi.fn(async () => '<html><body><h1>Overview</h1></body></html>'),
    look: vi.fn(async () => ({ background: null, text: null, button: null, body: null, heading: null })),
    click: vi.fn(async (target) => {
      if (target.selector === DEFAULT_SUBMIT_SELECTOR && loginWorks) {
        cookies = [COOKIE];
        at = `${APP}/dashboard`;
      }
    }),
    type: vi.fn(async (selector: string, text: string) => {
      typed.push([selector, text]);
    }),
    scroll: vi.fn(async () => undefined),
    waitFor: vi.fn(async () => undefined),
    sensitive: vi.fn(async () => false),
    shot: vi.fn(async () => Buffer.from('jpeg')),
    close: vi.fn(async () => 0.004),
    session: vi.fn(async () => kept()),
    restore: vi.fn(async (given: AppSession) => {
      cookies = sessionAlive ? given.cookies : [];
    }),
    label: vi.fn(async (target) => labels[target.selector ?? target.text ?? ''] ?? ''),
    ui: vi.fn(async () => UI),
    vector: vi.fn(async () => ({}))
  };
  return tab;
}

function memoryStore(initial: AppAccount | null = null): AppAccountStore & { saved: () => AppAccount | null } {
  let account = initial;
  return {
    read: vi.fn(async () => account),
    save: vi.fn(async (a: AppAccount) => {
      account = a;
    }),
    forget: vi.fn(async () => {
      account = null;
    }),
    saved: () => account
  };
}

const CREDS = { login_url: LOGIN, email: 'test@app.example', password: 'test-pass-1' };
const ports = (tab: AppTab, accounts: AppAccountStore) => ({ open: async () => tab, accounts, now: () => NOW, sleep: async () => undefined });

beforeEach(() => {
  vi.mocked(lookup).mockImplementation((async (host: string) => [{ address: host === 'internal.example' ? '10.0.0.1' : '93.184.216.34', family: 4 }]) as never);
});

describe('app_browse: a test account the user handed over in chat', () => {
  it('without an account asks for a TEST account and opens nothing', async () => {
    const open = vi.fn();

    const out = await appBrowse({ pages: ['/dashboard'] }, { open, accounts: memoryStore(), now: () => NOW });

    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('TEST account') });
    expect(open).not.toHaveBeenCalled();
  });

  it('logs in on the first call, remembers account and session, and photographs each page with its UI', async () => {
    const tab = fakeTab();
    const accounts = memoryStore();

    const out = await appBrowse({ ...CREDS, pages: ['/dashboard', `${APP}/projects`] }, ports(tab, accounts));

    expect(out).toMatchObject({ ok: true, session: 'fresh' });
    expect(tab.typed).toEqual([
      [expect.stringContaining('email'), 'test@app.example'],
      ['input[type="password"]', 'test-pass-1']
    ]);
    expect(tab.click).toHaveBeenCalledWith({ selector: DEFAULT_SUBMIT_SELECTOR });
    if (!out.ok) {
      return;
    }
    expect(out.pages.map((p) => p.url)).toEqual([`${APP}/dashboard`, `${APP}/projects`]);
    expect(out.pages[0]).toMatchObject({ ok: true, shot: 0, ui: UI });
    expect(out.shots).toHaveLength(2);
    expect(accounts.saved()).toMatchObject({ loginUrl: LOGIN, email: 'test@app.example', password: 'test-pass-1', session: { cookies: [COOKIE], storage: { jwt: 'tok' } }, sessionUntil: NOW + APP_SESSION_TTL_MS });
    expect(tab.close).toHaveBeenCalled();
  });

  it('on a later turn reuses the session without typing the password again', async () => {
    const tab = fakeTab();
    const accounts = memoryStore({ loginUrl: LOGIN, email: 'test@app.example', password: 'test-pass-1', session: SESSION, sessionUntil: NOW + 1 });

    const out = await appBrowse({ pages: ['/settings/billing'] }, ports(tab, accounts));

    expect(out).toMatchObject({ ok: true, session: 'reused' });
    expect(tab.restore).toHaveBeenCalledWith(SESSION, APP);
    expect(tab.typed).toEqual([]);
    expect(out.ok && out.pages[0]).toMatchObject({ url: `${APP}/settings/billing`, ok: true });
  });

  it('logs in again with the remembered account when the session expired', async () => {
    const tab = fakeTab({ sessionAlive: false });
    const accounts = memoryStore({ loginUrl: LOGIN, email: 'test@app.example', password: 'test-pass-1', session: SESSION, sessionUntil: NOW + 1 });

    const out = await appBrowse({ pages: ['/settings'] }, ports(tab, accounts));

    expect(out).toMatchObject({ ok: true, session: 'fresh' });
    expect(tab.typed).toHaveLength(2);
    expect(out.ok && out.pages[0]).toMatchObject({ url: `${APP}/settings`, ok: true });
  });

  it('a session past its time is not even tried', async () => {
    const tab = fakeTab();
    const accounts = memoryStore({ loginUrl: LOGIN, email: 'test@app.example', password: 'test-pass-1', session: SESSION, sessionUntil: NOW - 1 });

    await appBrowse({ pages: ['/settings'] }, ports(tab, accounts));

    expect(tab.restore).not.toHaveBeenCalled();
    expect(tab.typed).toHaveLength(2);
  });

  it('a login that stays on the sign-in page fails with a picture of it, and keeps no session', async () => {
    const tab = fakeTab({ loginWorks: false });
    const accounts = memoryStore();

    const out = await appBrowse({ ...CREDS, pages: ['/dashboard'] }, ports(tab, accounts));

    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('login') });
    expect(!out.ok && out.shots).toHaveLength(1);
    expect(accounts.saved()?.session).toEqual({ cookies: [], storage: {} });
    expect(tab.close).toHaveBeenCalled();
  });

  it('never signs in to a social platform', async () => {
    const open = vi.fn();

    const out = await appBrowse({ login_url: 'https://www.instagram.com/accounts/login/', email: 'a@b.c', password: 'x' }, { open, accounts: memoryStore(), now: () => NOW });

    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('Instagram') });
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a private address for the login', async () => {
    const out = await appBrowse({ login_url: 'http://internal.example/login', email: 'a@b.c', password: 'x' }, { open: vi.fn(), accounts: memoryStore(), now: () => NOW });

    expect(out).toMatchObject({ ok: false });
  });

  it('stays on the app: a page on another site is refused', async () => {
    const tab = fakeTab();

    const out = await appBrowse({ ...CREDS, pages: ['https://evil.example/steal'] }, ports(tab, memoryStore()));

    expect(out.ok && out.pages[0]).toMatchObject({ ok: false, error: expect.stringContaining('app.example') });
  });

  it('asks before a click that deletes, pays or invites, and clicks once the user confirmed', async () => {
    const steps = [{ do: StepKind.Click, selector: '#danger' }] as const;
    const tab = fakeTab({ labels: { '#danger': 'Delete project' } });

    const asked = await appBrowse({ ...CREDS, steps: [...steps] }, ports(tab, memoryStore()));

    expect(asked.ok && asked.steps[0]).toMatchObject({ ok: false, error: expect.stringContaining('confirm') });
    expect(tab.click).not.toHaveBeenCalledWith(expect.objectContaining({ selector: '#danger' }));

    const done = await appBrowse({ steps: [...steps], confirmed: true }, ports(tab, memoryStore({ ...CREDS_ACCOUNT })));

    expect(done).toMatchObject({ ok: true, steps: [{ ok: true }] });
    expect(tab.click).toHaveBeenCalledWith(expect.objectContaining({ selector: '#danger' }));
  });

  it('never types into a password or card field after the login', async () => {
    const tab = fakeTab();
    vi.mocked(tab.sensitive).mockResolvedValue(true);

    const out = await appBrowse({ ...CREDS, steps: [{ do: StepKind.Type, selector: '#card', text: '4242' }] }, ports(tab, memoryStore()));

    expect(out.ok && out.steps[0]).toMatchObject({ ok: false, error: expect.stringContaining('payment') });
  });

  it(`takes at most ${APP_MAX_SHOTS} pictures in one call`, async () => {
    const tab = fakeTab();
    const pages = Array.from({ length: APP_MAX_SHOTS }, (_, i) => `/p${i}`);

    const out = await appBrowse({ ...CREDS, pages, steps: [{ do: StepKind.Screenshot }] }, ports(tab, memoryStore()));

    expect(out.ok && out.shots).toHaveLength(APP_MAX_SHOTS);
  });
});

const CREDS_ACCOUNT: AppAccount = { loginUrl: LOGIN, email: 'test@app.example', password: 'test-pass-1', session: { cookies: [], storage: {} }, sessionUntil: null };

describe('destructive words: one table', () => {
  it.each([
    ['Delete project', 'delete'],
    ['Elimina account', 'elimina'],
    ['Send invite', 'invite'],
    ['Pay now', 'pay'],
    ['Upgrade plan', 'upgrade']
  ])('%s needs a confirmation', (label, word) => {
    expect(destructiveWord(label)).toBe(word);
  });

  it.each(['Settings', 'Payments history', 'Display options'])('%s does not', (label) => {
    expect(destructiveWord(label)).toBeNull();
  });
});
