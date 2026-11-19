import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirm = vi.fn();
const accountFor = vi.fn(() => ({ confirm }));

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-callback' } }));
vi.mock('$lib/server/connections/runtime', () => ({ accountFor: (...args: unknown[]) => accountFor(...(args as [])) }));

const { GET } = await import('./+server');
const { sealConnectState } = await import('$lib/server/connections/account-access');
const { Toolkit } = await import('$lib/server/connections/account-links');

type Handler = (event: unknown) => Promise<Response>;

async function call(query: string, user = 'u1') {
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/connections/callback?${query}`);
  try {
    return await (GET as unknown as Handler)({ locals, url, request: new Request(url) });
  } catch (thrown) {
    return thrown as { status: number; location: string };
  }
}

const sealed = (toolkit: string) => encodeURIComponent(sealConnectState({ orgId: 'o1', userId: 'u1', toolkit: toolkit as never, returnTo: '/settings/profile' }));

const state = encodeURIComponent(sealConnectState({ orgId: 'o1', userId: 'u1', toolkit: Toolkit.GitHub, returnTo: '/p/p1/c/c1' }));

beforeEach(() => {
  confirm.mockReset();
});

describe('GET /api/v1/connections/callback', () => {
  it('conferma il conto dello stesso utente e torna alla tela', async () => {
    confirm.mockResolvedValue(true);

    const done = (await call(`state=${state}&status=success&connected_account_id=ca_1`)) as { status: number; location: string };

    expect(confirm).toHaveBeenCalledWith('ca_1');
    expect(accountFor).toHaveBeenCalledWith({}, { orgId: 'o1', userId: 'u1' }, Toolkit.GitHub);
    expect(done).toMatchObject({ status: 302, location: '/p/p1/c/c1?github=connected' });
  });

  it('torna con il toolkit collegato, OneDrive come GitHub', async () => {
    confirm.mockResolvedValue(true);

    const done = (await call(`state=${sealed(Toolkit.OneDrive)}&connected_account_id=ca_2`)) as { location: string };

    expect(accountFor).toHaveBeenLastCalledWith({}, { orgId: 'o1', userId: 'u1' }, Toolkit.OneDrive);
    expect(done.location).toBe('/settings/profile?one_drive=connected');
  });

  it('un altro utente non può chiudere il collegamento', async () => {
    const res = (await call(`state=${state}&connected_account_id=ca_1`, 'u2')) as Response;

    expect(res.status).toBe(401);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('senza stato firmato è rifiutato', async () => {
    const res = (await call('state=forged&connected_account_id=ca_1')) as Response;

    expect(res.status).toBe(400);
  });
});
