import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirm = vi.fn();
const githubFor = vi.fn(() => ({ confirm }));

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-callback' } }));
vi.mock('$lib/server/code-import/github-runtime', () => ({ githubFor: (...args: unknown[]) => githubFor(...(args as [])) }));

const { GET } = await import('./+server');
const { sealConnectState } = await import('$lib/server/code-import/github-access');

type Handler = (event: unknown) => Promise<Response>;

async function call(query: string, user = 'u1') {
  const locals = { safeGetSession: async () => ({ user: { id: user } }), db: async () => ({}) };
  const url = new URL(`https://feega.test/api/v1/github/callback?${query}`);
  try {
    return await (GET as unknown as Handler)({ locals, url, request: new Request(url) });
  } catch (thrown) {
    return thrown as { status: number; location: string };
  }
}

const state = encodeURIComponent(sealConnectState({ orgId: 'o1', userId: 'u1', returnTo: '/p/p1/c/c1' }));

beforeEach(() => {
  confirm.mockReset();
});

describe('GET /api/v1/github/callback', () => {
  it('conferma il conto dello stesso utente e torna alla tela', async () => {
    confirm.mockResolvedValue(true);

    const done = (await call(`state=${state}&status=success&connected_account_id=ca_1`)) as { status: number; location: string };

    expect(confirm).toHaveBeenCalledWith('ca_1');
    expect(githubFor).toHaveBeenCalledWith({}, { orgId: 'o1', userId: 'u1' });
    expect(done).toMatchObject({ status: 302, location: '/p/p1/c/c1?github=connected' });
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
