import { describe, expect, it, vi } from 'vitest';

const { USER } = vi.hoisted(() => ({ USER: { id: 'u1', email: 'ada@x.it', user_metadata: {} } }));

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', async (original) => ({ ...(await original<object>()), verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/feature-flags', () => ({ isPlanGoEnabled: () => false }));
vi.mock('$lib/server/seline', () => ({ selineSetUser: vi.fn() }));
vi.mock('$lib/server/internal-users', () => ({ isInternalEmail: () => false }));
vi.mock('$lib/analytics', () => ({ trackingAllowed: (host: string) => host === 'feega.app' }));
vi.mock('$lib/server/social-publishing', () => ({ socialPublishing: async () => 'off' }));
vi.mock('$lib/server/dashboard/first-run-flags', () => ({ firstRunFlags: async (_db: unknown, user: unknown) => ({ termsNoticeVersion: null, tour: user ? 'seen' : null }) }));

const { GET } = await import('./+server');

function get(query = '', headers: Record<string, string> = {}) {
  const url = new URL(`https://api.feega.test/api/v1/me/root${query}`);
  const request = new Request(url, { headers });
  const locals = { safeGetSession: async () => ({ session: null, user: null }), db: async () => null };
  return GET({ request, url, locals } as never);
}

describe('the root shell over the API', () => {
  it('answers a bearer caller for the user the token names', async () => {
    const res = await get('', { authorization: 'Bearer jwt' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tour: 'seen', socialPublishing: 'off', planGo: false });
  });

  it('decides tracking for the host the app runs on, not the API host', async () => {
    const onApp = (await (await get('?host=feega.app', { authorization: 'Bearer jwt' })).json()) as { analyticsOptOut: boolean };
    const onApi = (await (await get('', { authorization: 'Bearer jwt' })).json()) as { analyticsOptOut: boolean };

    expect(onApp.analyticsOptOut).toBe(false);
    expect(onApi.analyticsOptOut).toBe(true);
  });

  it('answers an anonymous visitor from the cookie session, with no session', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ session: null, tour: null });
  });

  it('refuses a bearer that does not verify', async () => {
    expect((await get('', { authorization: 'Bearer bad' })).status).toBe(401);
  });
});
