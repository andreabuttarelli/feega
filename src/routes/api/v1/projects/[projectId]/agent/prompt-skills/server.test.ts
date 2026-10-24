import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const findReachableProject = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ orgId: 'org-1' }] }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));

import { GET, POST } from './+server';

const row = { id: 'sk-1', org_id: 'org-1', name: 'product-shot', body: 'Studio shot', deleted_at: null };

function call(handler: unknown, user: { id: string } | null, body?: unknown, db = fakeDb({ prompt_skills: [row] }, { filter: true })) {
  return (handler as (event: unknown) => Promise<Response>)({
    params: { projectId: 'p-1' },
    request: new Request('https://feega.test/x', { method: 'POST', body: JSON.stringify(body ?? {}) }),
    locals: { safeGetSession: async () => ({ user }), db: async () => db.db }
  }).then(async (res) => ({ res, body: await res.json(), calls: db.calls }));
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'org-1', project: { id: 'p-1' } });
});

describe('/api/v1/projects/[projectId]/agent/prompt-skills', () => {
  it('lists the skills of the project org', async () => {
    const { res, body, calls } = await call(GET, { id: 'user-1' });

    expect(res.status).toBe(200);
    expect(body.skills).toEqual([{ id: 'sk-1', name: 'product-shot', body: 'Studio shot' }]);
    expect(calls[0].filters).toContainEqual(['org_id', 'org-1']);
  });

  it('saves a skill for the org, signed by the user', async () => {
    const { res, calls } = await call(POST, { id: 'user-1' }, { name: 'poster', body: 'Risograph poster' }, fakeDb({ prompt_skills: [] }, { filter: true }));

    expect(res.status).toBe(201);
    expect(calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org-1', name: 'poster', actor_kind: 'user', actor_id: 'user-1' });
  });

  it('refuses without a session', async () => {
    expect((await call(GET, null)).res.status).toBe(401);
    expect((await call(POST, null, { name: 'a', body: 'b' })).res.status).toBe(401);
  });

  it('answers 404 for a project out of reach', async () => {
    findReachableProject.mockResolvedValue(null);

    expect((await call(GET, { id: 'user-1' })).res.status).toBe(404);
  });
});
