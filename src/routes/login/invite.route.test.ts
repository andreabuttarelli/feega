import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';
import { hashInviteToken } from '$lib/server/repos/invites';

const HOME = '/p/proj-b/c/canvas-b';
const ORG_A = 'org-a';
const INVITED = 'b@esempio.it';
const TOKEN = 'segreto';

let kit: TestSupabase;

vi.mock('$lib/server/db/client', async (orig) => ({
  ...(await orig<object>()),
  createServiceRoleDb: () => kit.client
}));
vi.mock('$lib/server/tenancy/entry', async (orig) => ({
  ...(await orig<object>()),
  homePathFor: vi.fn(async () => HOME)
}));
vi.mock('$lib/server/oauth', () => ({ takeOAuthReturn: () => null }));
vi.mock('$lib/server/supabase-admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: async () => ({ error: null }),
        generateLink: async () => ({ data: { properties: { hashed_token: 'h' } }, error: null })
      }
    }
  })
}));
vi.mock('$lib/server/email', () => ({
  sendEmail: vi.fn(async () => undefined),
  passwordResetEmailSubject: () => 's',
  passwordResetEmailHtml: () => 'h',
  passwordResetEmailText: (_locale: string, url: string) => url
}));

const { homePathFor } = await import('$lib/server/tenancy/entry');
const { sendEmail } = await import('$lib/server/email');
const login = await import('./+page.server');
const callback = await import('../auth/callback/+server');
const reset = await import('../auth/reset-password/+page.server');

const user = { id: 'user-b', email: INVITED };
const session = { access_token: 'jwt' };

function invite(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    org_id: ORG_A,
    email: INVITED,
    role: 'member',
    token: hashInviteToken(TOKEN),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    accepted_at: null,
    ...overrides
  };
}

function event(path: string, form: Record<string, string> = {}, signedIn = true) {
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) {
    body.set(k, v);
  }
  return {
    url: new URL(`https://feega.app${path}`),
    request: new Request(`https://feega.app${path}`, { method: 'POST', body }),
    cookies: { get: () => undefined, delete: () => undefined },
    locals: {
      safeGetSession: async () => (signedIn ? { session, user } : { session: null, user: null }),
      db: async () => kit.client,
      supabase: {
        auth: {
          signInWithPassword: async () => ({ error: null }),
          exchangeCodeForSession: async () => ({ data: { user }, error: null }),
          updateUser: async () => ({ error: null })
        }
      }
    }
  };
}

async function outcome(run: () => unknown) {
  try {
    return { data: await run() };
  } catch (error) {
    if (isRedirect(error)) {
      return { location: error.location };
    }
    throw error;
  }
}

const members = () => kit.tables.get('orgs_members') ?? [];
const acceptedAt = () => kit.tables.get('orgs_invites')![0].accepted_at;

beforeEach(() => {
  kit = createTestSupabase({ orgs_invites: [invite()], orgs_members: [], credit_ledger: [] });
  vi.mocked(homePathFor).mockClear();
});

function expectJoinedOrgA() {
  expect(members()).toEqual([expect.objectContaining({ org_id: ORG_A, user_id: 'user-b', role: 'member' })]);
  expect(acceptedAt()).not.toBeNull();
  expect(vi.mocked(homePathFor).mock.calls[0][3]).toBe(ORG_A);
}

describe("l'invito si accetta da ogni porta d'ingresso", () => {
  it('login con password', async () => {
    const res = await outcome(() =>
      (login.actions.login as any)(event('/login', { email: INVITED, password: 'pw', invite_token: TOKEN }))
    );

    expect(res).toEqual({ location: HOME });
    expectJoinedOrgA();
  });

  it('registrazione', async () => {
    const res = await outcome(() =>
      (login.actions.signup as any)(event('/login', { email: INVITED, password: 'password', invite_token: TOKEN }))
    );

    expect(res).toEqual({ location: HOME });
    expectJoinedOrgA();
  });

  it('chi è già dentro e apre il link', async () => {
    const res = await outcome(() => (login.load as any)(event(`/login?invite_token=${TOKEN}`)));

    expect(res).toEqual({ location: HOME });
    expectJoinedOrgA();
  });

  it('callback OAuth / magic link', async () => {
    const res = await outcome(() => (callback.GET as any)(event(`/auth/callback?code=c&invite_token=${TOKEN}`)));

    expect(res).toEqual({ location: HOME });
    expectJoinedOrgA();
  });

  it('nuova password dopo il reset', async () => {
    const res = await outcome(() =>
      (reset.actions.default as any)(
        event(`/auth/reset-password?invite_token=${TOKEN}`, { password: 'password', confirm: 'password' })
      )
    );

    expect(res).toEqual({ location: HOME });
    expectJoinedOrgA();
  });

  it("il token sopravvive al giro OAuth dentro l'indirizzo di ritorno", async () => {
    let redirectTo = '';
    const e = event('/login', { invite_token: TOKEN }, false);
    (e.locals.supabase.auth as any).signInWithOAuth = async (o: any) => {
      redirectTo = o.options.redirectTo;
      return { data: { url: 'https://github.com/login' }, error: null };
    };

    await outcome(() => (login.actions.github as any)(e));

    expect(new URL(redirectTo).searchParams.get('invite_token')).toBe(TOKEN);
  });

  it("il token sopravvive all'email di reset", async () => {
    await outcome(() => (login.actions.reset as any)(event('/login', { email: INVITED, invite_token: TOKEN }, false)));

    const link = new URL(String(vi.mocked(sendEmail).mock.calls[0][0].text));
    const next = new URL(link.searchParams.get('next')!, 'https://feega.app');
    expect(next.pathname).toBe('/auth/reset-password');
    expect(next.searchParams.get('invite_token')).toBe(TOKEN);
  });
});

describe('un invito che non vale si dice sul login', () => {
  it('scaduto', async () => {
    kit = createTestSupabase({ orgs_invites: [invite({ expires_at: '2020-01-01T00:00:00Z' })], orgs_members: [] });

    const res = await outcome(() =>
      (login.actions.login as any)(event('/login', { email: INVITED, password: 'pw', invite_token: TOKEN }))
    );

    expect(res).toEqual({ location: '/login?invite_error=invalid' });
    expect(members()).toEqual([]);
  });

  it("per un'altra email", async () => {
    kit = createTestSupabase({ orgs_invites: [invite({ email: 'altro@esempio.it' })], orgs_members: [] });

    const res = await outcome(() => (login.load as any)(event(`/login?invite_token=${TOKEN}`)));

    expect(res).toEqual({ location: '/login?invite_error=wrong_email' });
    expect(acceptedAt()).toBeNull();
  });

  it('il login mostra il motivo invece di rimandare alla tela', async () => {
    const res = await outcome(() => (login.load as any)(event('/login?invite_error=invalid')));

    expect(res).toEqual({ data: expect.objectContaining({ inviteError: 'invalid', homeHref: HOME }) });
  });

  it('chi non è dentro vede il token portato nei moduli', async () => {
    const res = await outcome(() => (login.load as any)(event(`/login?invite_token=${TOKEN}`, {}, false)));

    expect(res).toEqual({ data: expect.objectContaining({ inviteToken: TOKEN }) });
  });
});
