import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }));

import { DEFAULT_EMAIL_SELECTOR, DEFAULT_PASSWORD_SELECTOR, DEFAULT_SUBMIT_SELECTOR } from '$lib/server/web/app-browse';
import type { AppSession, AppTab, SessionCookie } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { CodeImportOutcome, Crop, importBoards, type BoardsAsk } from './import-code';
import { Locked } from './sign-in';

const APP = 'https://sb-1.vercel.run';
const PASSWORD = 'fake-test-password';
const ACCOUNT = { loginUrl: 'https://app.acme.example/login', email: 'qa@acme.example', password: PASSWORD };
const COOKIE: SessionCookie = { name: 'sid', value: 'ok', domain: 'sb-1.vercel.run', path: '/', expires: -1, httpOnly: true, secure: true };
const PROTECTED = ['/billing'];

type Server = { tabs: (AppTab & { typed: string[]; restored: AppSession[] })[]; trees: string[] };

function pageServer(opts: { form?: boolean } = {}) {
  const server: Server = { tabs: [], trees: [] };
  const open = async () => {
    let at = 'about:blank';
    let cookies: SessionCookie[] = [];
    const typed: string[] = [];
    const restored: AppSession[] = [];
    const go = (url: string) => {
      const path = new URL(url).pathname;
      at = PROTECTED.includes(path) && !cookies.length ? `${APP}/login?next=${encodeURIComponent(path)}` : url;
    };
    const tab = {
      typed,
      restored,
      goto: vi.fn(async (url: string) => {
        go(url);
        return 200;
      }),
      url: () => at,
      waitFor: vi.fn(async (selector: string) => {
        const onLogin = new URL(at).pathname === '/login';
        if (!onLogin || (selector === DEFAULT_EMAIL_SELECTOR && opts.form === false)) {
          throw new Error(`no ${selector}`);
        }
      }),
      type: vi.fn(async (selector: string, text: string) => {
        typed.push(selector === DEFAULT_PASSWORD_SELECTOR ? '[typed password]' : text);
        if (selector === DEFAULT_PASSWORD_SELECTOR && text === PASSWORD) {
          typed.push('password ok');
        }
      }),
      click: vi.fn(async (target: { selector?: string }) => {
        if (target.selector === DEFAULT_SUBMIT_SELECTOR && typed.includes('password ok')) {
          cookies = [COOKIE];
          go(`${APP}/`);
        }
      }),
      session: vi.fn(async () => ({ cookies, storage: {} })),
      restore: vi.fn(async (session: AppSession) => {
        restored.push(session);
        cookies = session.cookies;
      }),
      scroll: vi.fn(async () => undefined),
      reveal: vi.fn(async () => ({ height: 900, hidden: 0 })),
      settle: vi.fn(async () => undefined),
      scheme: vi.fn(async () => undefined),
      viewport: vi.fn(async () => undefined),
      seeAll: vi.fn(async () => undefined),
      sample: vi.fn(async () => 0),
      overlay: vi.fn(async () => null),
      press: vi.fn(async () => undefined),
      label: vi.fn(async () => ''),
      shot: vi.fn(async () => Buffer.from('jpeg')),
      ui: vi.fn(async () => ({ title: '', elements: [] })),
      marks: vi.fn(async () => []),
      tree: vi.fn(async (): Promise<PageTree> => {
        server.trees.push(new URL(at).pathname);
        return treeAt(at);
      }),
      close: vi.fn(async () => 0)
    } as unknown as Server['tabs'][number];
    server.tabs.push(tab);
    return tab;
  };
  return { server, open };
}

function treeAt(url: string): PageTree {
  return {
    title: new URL(url).pathname,
    url,
    width: 400,
    height: 200,
    truncated: false,
    root: { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [] }
  };
}

function askOf(open: BoardsAsk['open'], routes: string[], account: BoardsAsk['account'] = null): BoardsAsk {
  const docs = new Map<string, unknown>();
  const store = {
    create: vi.fn(async (_at: unknown, doc: unknown) => {
      docs.set('frame-1', doc);
      return 'frame-1';
    }),
    read: vi.fn(async (id: string) => (docs.has(id) ? { doc: docs.get(id), version: 1 } : null)),
    write: vi.fn(async () => true)
  } as unknown as FrameStore;
  let n = 0;
  return {
    name: 'app',
    pages: routes.map((r) => ({ label: r, url: `${APP}${r}` })),
    names: [],
    crop: Crop.Page,
    at: { x: 0, y: 0 },
    store,
    place: { projectId: 'p', canvasId: 'c' },
    open,
    guard: async () => undefined,
    importImage: async () => null,
    newId: () => `n${++n}`,
    settleMs: 0,
    account
  };
}

describe('code import of routes behind a login', () => {
  it('without a test account, a route sent to /login is reported as needing sign-in, not imported as the route', async () => {
    const { open } = pageServer();

    const done = await importBoards(askOf(open, ['/', '/billing']));

    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/'], locked: [{ label: '/billing', reason: Locked.NoAccount }] });
  });

  it('when every route needs sign-in, nothing is imported and the answer says why', async () => {
    const { open, server } = pageServer();

    const done = await importBoards(askOf(open, ['/billing']));

    expect(done).toMatchObject({ outcome: CodeImportOutcome.SignInNeeded, locked: [{ label: '/billing', reason: Locked.NoAccount }] });
    expect(server.tabs.every((t) => t.close)).toBe(true);
  });

  it('with a test account, signs in on the login path of the app under import and captures the protected route in that session', async () => {
    const { open, server } = pageServer();

    const done = await importBoards(askOf(open, ['/', '/billing'], ACCOUNT));

    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/', '/billing'], locked: [] });
    expect(server.tabs[0].goto).toHaveBeenCalledWith(`${APP}/login`);
    expect(server.tabs[0].typed).toEqual([ACCOUNT.email, '[typed password]', 'password ok']);
    expect(server.trees).toEqual(['/', '/billing']);
    expect(server.tabs.slice(1).every((t) => t.restored[0]?.cookies[0]?.value === 'ok')).toBe(true);
  });

  it('a failed sign-in is reported per locked route, the public routes still import, the password never shows', async () => {
    const { open } = pageServer({ form: false });

    const done = await importBoards(askOf(open, ['/', '/billing'], ACCOUNT));

    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['/'], locked: [{ label: '/billing', reason: Locked.SignInFailed, detail: expect.stringContaining('no email field') }] });
    expect(JSON.stringify(done)).not.toContain(PASSWORD);
  });
});
