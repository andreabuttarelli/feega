import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...a: unknown[]) => resolveOrgCaller(...a) }));

import { POST } from './+server';

const PLANNED = '2026-10-02T08:00:00.000Z';

function post(body: unknown) {
  const url = new URL('https://feega.test/api/v1/org/posts');
  return (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify(body) }),
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

let fake: ReturnType<typeof fakeDb>;

beforeEach(() => {
  vi.clearAllMocks();
  fake = fakeDb({
    posts: [],
    nodes: [{ id: 'n1', org_id: 'org-1', canvas_id: 'c1', project_id: 'p1', type: 'image', data: { assetId: 'a1' }, position: { x: 0, y: 0 }, size: {}, version: 1, deleted_at: null }]
  });
  resolveOrgCaller.mockResolvedValue({ caller: { db: fake.db, orgId: 'org-1', userId: 'u', apiKeyId: 'k', writeAllowed: true } });
});

describe('POST /api/v1/org/posts planned_for', () => {
  it('una bozza con caption porta la data pianificata', async () => {
    const { res } = await post({ brand_id: 'b1', caption: 'Ciao', planned_for: PLANNED });

    expect(res.status).toBe(200);
    expect(fake.calls.find((c) => c.table === 'posts' && c.op === 'insert')?.payload).toMatchObject({ planned_for: PLANNED });
  });

  it('una bozza da node_ids porta la data pianificata', async () => {
    const { res } = await post({ brand_id: 'b1', node_ids: ['n1'], planned_for: PLANNED });

    expect(res.status).toBe(200);
    expect(fake.calls.find((c) => c.table === 'posts' && c.op === 'insert')?.payload).toMatchObject({ planned_for: PLANNED });
  });

  it('una data illeggibile è rifiutata prima di scrivere', async () => {
    const { res, body } = await post({ brand_id: 'b1', caption: 'Ciao', planned_for: 'domani' });

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_planned_for');
    expect(fake.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
