import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { START_URL_COOKIE } from '$lib/server/onboarding/start-url-cookie';

const SITE = '/p/site/c/canvas?start_url=https%3A%2F%2Fstripe.com%2F';
const STRIPE = 'https://stripe.com/';

vi.mock('$lib/server/tenancy/landing', async (orig) => {
  const real = await orig<typeof import('$lib/server/tenancy/landing')>();
  return {
    ...real,
    landingPath: (db: never, user: never, cookies: never, invite: string | null) =>
      real.landingPath(db, user, cookies, invite, {
        ensureProfile: async () => ({ termsAcceptedAt: 'x' }) as never,
        recordTermsAcceptance: async () => undefined,
        acceptInvite: async () => ({ outcome: 'invalid' }) as never,
        homePathFor: async () => '/app',
        startPathFor: async (_db, _deps, _user, _org, url) => (url === STRIPE ? SITE : '/wrong')
      })
  };
});
vi.mock('$lib/server/oauth', () => ({ takeOAuthReturn: () => null }));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => ({ auth: { admin: { createUser: async () => ({ error: null }), generateLink: async () => ({ data: { properties: { hashed_token: 'h' } }, error: null }) } } }) }));
vi.mock('$lib/server/email', () => ({ sendEmail: vi.fn(async () => undefined), passwordResetEmailSubject: () => 's', passwordResetEmailHtml: () => 'h', passwordResetEmailText: (_l: string, url: string) => url }));

const { sendEmail } = await import('$lib/server/email');
const login = await import('./+page.server');
const callback = await import('../auth/callback/+server');

const user = { id: 'u', email: 'a@b.it' };

function event(path: string, form: Record<string, string> = {}, jar: Record<string, string> = { [START_URL_COOKIE]: STRIPE }) {
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) {
    body.set(k, v);
  }
  return {
    jar,
    url: new URL(`https://oh.feega.app${path}`),
    request: new Request(`https://oh.feega.app${path}`, { method: 'POST', body }),
    cookies: { get: (n: string) => jar[n], delete: (n: string) => void delete jar[n], set: () => undefined },
    locals: {
      safeGetSession: async () => ({ session: { access_token: 'jwt' }, user }),
      db: async () => ({}),
      supabase: { auth: { signInWithPassword: async () => ({ error: null }), exchangeCodeForSession: async () => ({ data: { user }, error: null }) } as Record<string, unknown> }
    }
  };
}

async function location(run: () => unknown): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (isRedirect(error)) {
      return error.location;
    }
    throw error;
  }
}

describe('the start url survives every way in', () => {
  it('email and password sign-in', async () => {
    const e = event('/login', { email: 'a@b.it', password: 'secret1' });
    expect(await location(() => (login.actions.login as any)(e))).toBe(SITE);
    expect(e.jar).not.toHaveProperty(START_URL_COOKIE);
  });

  it('sign-up', async () => {
    expect(await location(() => (login.actions.signup as any)(event('/login', { email: 'a@b.it', password: 'secret1' })))).toBe(SITE);
  });

  it('Google OAuth carries it in the return address and the callback lands on the site', async () => {
    let redirectTo = '';
    const e = event('/login');
    e.locals.supabase.auth.signInWithOAuth = async (o: any) => {
      redirectTo = o.options.redirectTo;
      return { data: { url: 'https://accounts.google.com' }, error: null };
    };

    await location(() => (login.actions.google as any)(e));

    expect(new URL(redirectTo).searchParams.get('start_url')).toBe(STRIPE);
    expect(e.jar[START_URL_COOKIE]).toBe(STRIPE);
  });

  it('the OAuth callback lands on the site project', async () => {
    expect(await location(() => callback.GET(event('/auth/callback?code=c') as any))).toBe(SITE);
  });

  it('an already signed-in visitor on /login', async () => {
    expect(await location(() => login.load(event('/login') as any))).toBe(SITE);
  });

  it('the password reset email carries it', async () => {
    await location(() => (login.actions.reset as any)(event('/login', { email: 'a@b.it' })));

    const link = new URL(String(vi.mocked(sendEmail).mock.calls[0][0].text));
    const next = new URL(link.searchParams.get('next')!, 'https://oh.feega.app');
    expect(next.pathname).toBe('/auth/reset-password');
    expect(next.searchParams.get('start_url')).toBe(STRIPE);
  });

  it('a website visitor is offered sign-up first', async () => {
    const e = event(`/login?start_url=${encodeURIComponent(STRIPE)}`);
    e.locals.safeGetSession = async () => ({ session: null, user: null }) as never;
    const page = (await login.load(e as any)) as { preferSignup: boolean };
    expect(page.preferSignup).toBe(true);
  });
});
