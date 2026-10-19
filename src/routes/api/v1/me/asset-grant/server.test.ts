import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-grants' } }));
vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => ({}) }));
const EXP = 1_900_000_000;
const JWT = `h.${Buffer.from(JSON.stringify({ exp: EXP })).toString('base64url')}.s`;
vi.mock('$lib/server/nav-cache', async (original) => ({ ...(await original<object>()), verifiedToken: async (_db: unknown, token: string) => (token === JWT ? { id: 'u1' } : null) }));

const { GET } = await import('./+server');
const { openAssetGrant } = await import('$lib/server/canvas/asset-grant');

function get(token: string) {
  const url = new URL('https://feega.app/api/v1/me/asset-grant');
  return GET({ request: new Request(url, { headers: { authorization: `Bearer ${token}` } }), url } as never);
}

describe('the asset grant for a bundle', () => {
  it('seals the caller’s own token, valid as long as the token is', async () => {
    const res = await get(JWT);
    const body = (await res.json()) as { grant: string; expiresAt: number };

    expect(res.status).toBe(200);
    expect(openAssetGrant(body.grant)).toBe(JWT);
    expect(body.expiresAt).toBe(EXP * 1000);
  });

  it('refuses a token that does not verify', async () => {
    expect((await get('bad')).status).toBe(401);
  });
});
