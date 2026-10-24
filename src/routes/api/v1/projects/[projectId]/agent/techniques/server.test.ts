import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const findReachableProject = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ orgId: 'org-1' }] }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));

import { GET } from './+server';

const row = { id: 'tq-1', org_id: 'org-1', name: 'idea-to-picture', version: 1, plan: { nodes: [{}, {}], edges: [] }, inputs: [{ node: 0, type: 'text' }], outputs: [{ node: 1, type: 'image' }], deleted_at: null };

function call(user: { id: string } | null) {
  const db = fakeDb({ techniques: [row] }, { filter: true });
  return (GET as (event: unknown) => Promise<Response>)({
    params: { projectId: 'p-1' },
    locals: { safeGetSession: async () => ({ user }), db: async () => db.db }
  }).then(async (res) => ({ res, body: await res.json(), calls: db.calls }));
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'org-1', project: { id: 'p-1' } });
});

describe('GET /api/v1/projects/[projectId]/agent/techniques', () => {
  it('lists the techniques of the project org', async () => {
    const { res, body, calls } = await call({ id: 'user-1' });

    expect(res.status).toBe(200);
    expect(body.techniques).toEqual([{ id: 'tq-1', name: 'idea-to-picture', nodes: 2, version: 1, inputs: [{ node: 0, type: 'text' }], outputs: [{ node: 1, type: 'image' }] }]);
    expect(calls[0].filters).toContainEqual(['org_id', 'org-1']);
  });

  it('refuses without a session', async () => {
    expect((await call(null)).res.status).toBe(401);
  });

  it('answers 404 for a project out of reach', async () => {
    findReachableProject.mockResolvedValue(null);

    expect((await call({ id: 'user-1' })).res.status).toBe(404);
  });
});
