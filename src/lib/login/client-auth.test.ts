import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Runtime } from '$lib/runtime';

const runtime = vi.hoisted(() => ({ value: 'hosted' }));
const oauth = vi.hoisted(() => ({ redirectTo: '' }));
const fetched = vi.hoisted(() => ({ body: null as Record<string, unknown> | null }));

vi.mock('$lib/runtime', async (orig) => ({
  ...(await orig<object>()),
  get RUNTIME() {
    return runtime.value;
  },
  HOSTED_ORIGIN: ''
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/dashboard/api', () => ({ call: vi.fn(), chooseWorkspace: vi.fn(), withOrg: (p: string) => p }));
vi.mock('$lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithOAuth: async ({ options }: { options: { redirectTo: string } }) => {
        oauth.redirectTo = options.redirectTo;
        return { data: { url: 'https://accounts.google.com/o/oauth2' }, error: null };
      }
    }
  })
}));

const { afterSignIn, OAuthProvider, sendReset, startOAuth } = await import('./client-auth');

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const NATIVE_SHELL = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) FeegaNative/0.1.0';

function at(href: string, userAgent = BROWSER) {
  const location = Object.assign(new URL(href), { assign: vi.fn() });
  vi.stubGlobal('location', location);
  vi.stubGlobal('navigator', { userAgent });
  return location;
}

beforeEach(() => {
  runtime.value = Runtime.Hosted;
  oauth.redirectTo = '';
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    fetched.body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ reset: true }), { status: 200 });
  });
});

describe('OAuth starts in the browser and comes back to the right callback', () => {
  it('a browser on the web comes back to the web callback', async () => {
    at('https://oh.feega.app/login');
    await startOAuth(OAuthProvider.Google, new URLSearchParams());

    expect(oauth.redirectTo).toBe('https://oh.feega.app/auth/callback');
  });

  it('the CLI login and the invite survive the round trip', async () => {
    at('https://oh.feega.app/login');
    await startOAuth(OAuthProvider.GitHub, new URLSearchParams({ cli_port: '9876', cli_state: 's', invite_token: 'tok', plan: 'pro' }));

    const back = new URL(oauth.redirectTo);
    expect(back.pathname).toBe('/auth/callback');
    expect(Object.fromEntries(back.searchParams)).toEqual({ cli_port: '9876', cli_state: 's', invite_token: 'tok' });
  });

  it('the hosted page inside the native shell comes back through feega://', async () => {
    at('https://oh.feega.app/login', NATIVE_SHELL);
    await startOAuth(OAuthProvider.Google, new URLSearchParams({ invite_token: 'tok' }));

    expect(oauth.redirectTo).toBe('feega://auth/callback?invite_token=tok');
  });

  it('the bundle comes back through feega://', async () => {
    runtime.value = Runtime.Bundle;
    at('http://tauri.localhost/login', BROWSER);
    await startOAuth(OAuthProvider.Google, new URLSearchParams());

    expect(oauth.redirectTo).toBe('feega://auth/callback');
  });
});

describe('after signing in', () => {
  it('the web reloads the login page, whose server load routes the user (MCP consent, CLI, invite, home)', async () => {
    const location = at('https://oh.feega.app/login?invite_token=tok&cli_port=1');
    await afterSignIn();

    expect(location.assign).toHaveBeenCalledWith('/login?invite_token=tok&cli_port=1');
  });
});

describe('password reset', () => {
  it('the invite token travels with the reset email', async () => {
    at('https://oh.feega.app/login');
    await sendReset('a@b.it', 'it', 'tok');

    expect(fetched.body).toEqual({ email: 'a@b.it', locale: 'it', invite: 'tok' });
  });
});
