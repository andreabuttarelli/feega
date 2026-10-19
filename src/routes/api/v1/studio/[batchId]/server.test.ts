import { describe, expect, it, vi } from 'vitest';

const { USER } = vi.hoisted(() => ({ USER: { id: 'u', email: 'ada@x.it' } }));

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<object>()), createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', async (original) => ({ ...(await original<object>()), verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));

const batchScope = vi.fn(async (event: { params: { batchId: string } }) => ({ db: {}, orgId: 'org', projectId: 'proj', userId: 'u', batch: { id: event.params.batchId, name: 'Mugs' } }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ batchScope }));
const approveItem = vi.fn(async () => undefined);
vi.mock('$lib/server/studio/studio-batch', async (original) => ({ ...(await original<object>()), approveItem }));

const { POST } = await import('./+server');

function post(action: string, fields: Record<string, string>, token = 'jwt') {
  const body = new FormData();
  Object.entries(fields).forEach(([k, v]) => body.set(k, v));
  const url = new URL(`https://feega.test/api/v1/studio/batch-1?action=${action}`);
  const request = new Request(url, { method: 'POST', body, headers: { authorization: `Bearer ${token}` } });
  return POST({ request, url, params: { batchId: 'batch-1' } } as never);
}

describe('a photo studio batch over bearer', () => {
  it('runs the page approve action on the batch the path names', async () => {
    const res = await post('approve', { itemId: 'i1' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(approveItem).toHaveBeenCalledWith({}, expect.objectContaining({ batch: expect.objectContaining({ id: 'batch-1' }) }), expect.objectContaining({ itemId: 'i1' }));
  });

  it('an unknown action is not found, a bad token is unauthorized', async () => {
    expect((await post('nope', {})).status).toBe(404);
    expect((await post('approve', { itemId: 'i1' }, 'bad')).status).toBe(401);
  });
});
