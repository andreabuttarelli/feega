import { describe, expect, it, vi } from 'vitest';

const callers: Record<string, unknown> = {
  jwt: { db: {}, orgId: 'org', userId: 'u', writeAllowed: true },
  feega_key: { db: {}, orgId: 'org', userId: 'u', apiKeyId: 'k', writeAllowed: true },
  feega_readonly: { db: {}, orgId: 'org', userId: 'u', apiKeyId: 'k', writeAllowed: false }
};
vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: async (token: string) => (callers[token] ? { caller: callers[token] } : { error: { status: 401, body: { error: 'invalid_token' } } })
}));
vi.mock('$lib/server/repos/product-batches', async (original) => ({
  ...(await original<object>()),
  findBatch: async (_db: unknown, scope: { batchId: string }) => (scope.batchId === 'batch-1' ? { id: 'batch-1', projectId: 'proj' } : null)
}));
const applyAction = vi.fn(async () => ({ data: { ok: true } }) as unknown);
vi.mock('$lib/server/studio/studio-actions', async (original) => ({ ...(await original<object>()), applyAction }));
vi.mock('$lib/server/studio/batch-page', () => ({ batchView: async () => ({ items: [] }) }));

const { GET, POST } = await import('./+server');

function post(action: string, body: unknown, token = 'jwt') {
  const url = new URL(`https://feega.test/api/v1/studio/batch-1?action=${action}`);
  const request = new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } });
  return POST({ request, url, params: { batchId: 'batch-1' } } as never);
}

describe('a photo studio batch over bearer', () => {
  it('runs the action the query names on the batch the path names', async () => {
    const res = await post('approve', { itemIds: ['i1'] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(applyAction).toHaveBeenCalledWith(expect.objectContaining({ batch: expect.objectContaining({ id: 'batch-1' }) }), 'approve', { itemIds: ['i1'], variations: 1 });
  });

  it('accepts an API key, and refuses a read-only one', async () => {
    expect((await post('cancel', {}, 'feega_key')).status).toBe(200);
    expect((await post('cancel', {}, 'feega_readonly')).status).toBe(403);
  });

  it('reads the batch with an API key', async () => {
    const url = new URL('https://feega.test/api/v1/studio/batch-1');
    const res = await GET({ request: new Request(url, { headers: { authorization: 'Bearer feega_readonly' } }), url, params: { batchId: 'batch-1' } } as never);

    expect(await res.json()).toEqual({ items: [] });
  });

  it('an unknown action or batch is not found, a bad token is unauthorized', async () => {
    expect((await post('nope', {})).status).toBe(404);
    const url = new URL('https://feega.test/api/v1/studio/other?action=run');
    const request = new Request(url, { method: 'POST', body: '{}', headers: { authorization: 'Bearer jwt' } });
    expect((await POST({ request, url, params: { batchId: 'other' } } as never)).status).toBe(404);
    expect((await post('approve', {}, 'bad')).status).toBe(401);
  });
});
