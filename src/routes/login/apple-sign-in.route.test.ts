import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

vi.mock('$lib/server/oauth', () => ({ takeOAuthReturn: () => null }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/tenancy/landing', async (orig) => ({
  ...(await orig<object>()),
  landingPath: async () => '/p/proj1/c/canvas1'
}));

const login = await import('./+page.server');

const PRODUCTION = 'https://oh.feega.app/login';
const LOCAL = 'http://localhost:5173/login';
const SAFARI = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15';

type Calls = { oauth: string[]; idToken: { provider: string; token: string; nonce: string }[] };

function event(href: string, form: Record<string, string>, calls: Calls) {
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) {
    body.set(k, v);
  }
  return {
    url: new URL(href),
    cookies: { get: () => undefined, delete: () => undefined, set: () => undefined },
    request: new Request(href, { method: 'POST', body, headers: { 'user-agent': SAFARI } }),
    locals: {
      safeGetSession: async () => ({ session: { access_token: 'jwt' }, user: { id: 'u1' } }),
      db: async () => ({}),
      supabase: {
        auth: {
          signInWithOAuth: async (o: { provider: string }) => {
            calls.oauth.push(o.provider);
            return { data: { url: 'https://appleid.apple.com/auth/authorize' }, error: null };
          },
          signInWithIdToken: async (c: Calls['idToken'][number]) => {
            calls.idToken.push(c);
            return { data: {}, error: null };
          }
        }
      }
    }
  };
}

async function act(name: 'apple' | 'appleIdToken', href: string, form: Record<string, string> = {}) {
  const calls: Calls = { oauth: [], idToken: [] };
  const action = login.actions[name] as unknown as (e: unknown) => Promise<unknown>;
  try {
    const result = await action(event(href, form, calls));
    return { calls, result, location: null as string | null };
  } catch (error) {
    if (!isRedirect(error)) {
      throw error;
    }
    return { calls, result: null, location: error.location };
  }
}

async function shown(href: string): Promise<boolean> {
  const loadEvent = {
    url: new URL(href),
    request: new Request(href, { headers: { 'user-agent': SAFARI } }),
    cookies: { get: () => undefined, delete: () => undefined },
    locals: { safeGetSession: async () => ({ session: null, user: null }), db: async () => null }
  };
  const page = (await (login.load as unknown as (e: unknown) => Promise<{ appleSignIn: boolean }>)(loadEvent));
  return page.appleSignIn;
}

describe('Sign in with Apple on the login page', () => {
  it('production does not offer it', async () => {
    expect(await shown(PRODUCTION)).toBe(false);
  });

  it('localhost offers it', async () => {
    expect(await shown(LOCAL)).toBe(true);
  });

  it('production refuses the web flow without asking Supabase', async () => {
    const { calls, result } = await act('apple', PRODUCTION);
    expect(calls.oauth).toEqual([]);
    expect((result as { status: number }).status).toBe(404);
  });

  it('localhost starts the Apple OAuth flow', async () => {
    const { calls, location } = await act('apple', LOCAL);
    expect(calls.oauth).toEqual(['apple']);
    expect(location).toBe('https://appleid.apple.com/auth/authorize');
  });

  it('production refuses a native identity token', async () => {
    const { calls, result } = await act('appleIdToken', PRODUCTION, { token: 'id.jwt', nonce: 'raw' });
    expect(calls.idToken).toEqual([]);
    expect((result as { status: number }).status).toBe(404);
  });

  it('a native identity token signs in with its raw nonce and lands in the app', async () => {
    const { calls, location } = await act('appleIdToken', LOCAL, { token: 'id.jwt', nonce: 'raw' });
    expect(calls.idToken).toEqual([{ provider: 'apple', token: 'id.jwt', nonce: 'raw' }]);
    expect(location).toBe('/p/proj1/c/canvas1');
  });

  it('a token without a nonce is refused', async () => {
    const { calls, result } = await act('appleIdToken', LOCAL, { token: 'id.jwt' });
    expect(calls.idToken).toEqual([]);
    expect((result as { status: number }).status).toBe(400);
  });
});
