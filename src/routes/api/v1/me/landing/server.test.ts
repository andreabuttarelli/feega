import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = { id: 'u1', email: 'ada@x.it' };
vi.mock('$lib/server/db/client', () => ({ createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? { id: 'u1', email: 'ada@x.it' } : null) }));

const landingPath = vi.fn();
vi.mock('$lib/server/tenancy/landing', async (original) => ({ ...(await original<object>()), landingPath }));

const generateLink = vi.fn();
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => ({ auth: { admin: { generateLink } } }) }));

const landing = await import('./+server');
const handoff = await import('../handoff/+server');

async function call(handler: unknown, method: string, path: string, body?: unknown, token = 'jwt') {
  const url = new URL(`https://feega.test/api/v1/me/${path}`);
  const request = new Request(url, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const res = await (handler as (e: unknown) => Promise<Response>)({ request, url });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/me/landing: where a fresh sign-in goes, as the login action decides', () => {
  it('runs the same landing as the login action, with the invite and workspace the client holds', async () => {
    landingPath.mockImplementation(async (_db, _user, cookies: { get: (n: string) => string | undefined; set: (n: string, v: string) => void }) => {
      cookies.set('dz-org', 'org-2');
      return `/p/p1/c/c1?from=${cookies.get('dz-org')}`;
    });

    const { status, body } = await call(landing.GET, 'GET', 'landing?invite_token=tok&org=org-1');

    expect(status).toBe(200);
    expect(landingPath).toHaveBeenCalledWith(expect.anything(), USER, expect.anything(), 'tok');
    expect(body).toEqual({ redirect: '/p/p1/c/c1?from=org-2', org: 'org-2' });
  });

  it('refuses a bad token', async () => {
    expect((await call(landing.GET, 'GET', 'landing', undefined, 'bad')).status).toBe(401);
  });
});

describe('POST /api/v1/me/handoff: a one-time link that opens a hosted page signed in', () => {
  it('mints a magic link for the caller and points it at the hosted page', async () => {
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'h1' } }, error: null });

    const { status, body } = await call(handoff.POST, 'POST', 'handoff', { next: '/p/p1/c/c1' });

    expect(status).toBe(200);
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'ada@x.it' });
    expect(body).toEqual({ url: 'https://feega.test/auth/confirm?token_hash=h1&type=magiclink&next=%2Fp%2Fp1%2Fc%2Fc1' });
  });

  it('never points off the app', async () => {
    expect((await call(handoff.POST, 'POST', 'handoff', { next: '//evil.com' })).status).toBe(400);
    expect((await call(handoff.POST, 'POST', 'handoff', { next: 'https://evil.com' })).status).toBe(400);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('a link that cannot be minted is an error, not a silent sign-out', async () => {
    generateLink.mockResolvedValue({ data: null, error: new Error('down') });
    expect((await call(handoff.POST, 'POST', 'handoff', { next: '/p/p1' })).status).toBe(502);
  });
});
