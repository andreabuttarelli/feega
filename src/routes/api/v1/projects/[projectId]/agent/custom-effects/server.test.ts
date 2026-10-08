import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const findReachableProject = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ orgId: 'org-1' }] }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: (...args: unknown[]) => findReachableProject(...args) }));

import { GET } from './+server';

const row = { id: 'fx-1', org_id: 'org-1', name: 'vhs', version: 1, frag: 'f', params: [], check_state: 'passed', check_problems: [], cost_ms: 2, updated_at: 'now', deleted_at: null };

function call(user: { id: string } | null, db = fakeDb({ effects: [row] }, { filter: true })) {
  return (GET as (event: unknown) => Promise<Response>)({
    params: { projectId: 'p-1' },
    locals: { safeGetSession: async () => ({ user }), db: async () => db.db }
  }).then(async (res) => ({ res, body: await res.json(), calls: db.calls }));
}

beforeEach(() => {
  findReachableProject.mockResolvedValue({ orgId: 'org-1', project: { id: 'p-1' } });
});

describe('GET /api/v1/projects/[projectId]/agent/custom-effects', () => {
  it('lists the workspace effects of the project org', async () => {
    const { res, body, calls } = await call({ id: 'user-1' });

    expect(res.status).toBe(200);
    expect(body.effects.map((e: { name: string }) => e.name)).toEqual(['vhs']);
    expect(calls[0].filters).toContainEqual(['org_id', 'org-1']);
  });

  it('refuses without a session', async () => {
    const { res } = await call(null);

    expect(res.status).toBe(401);
  });

  it('answers 404 for a project out of reach', async () => {
    findReachableProject.mockResolvedValue(null);

    const { res } = await call({ id: 'user-1' });

    expect(res.status).toBe(404);
  });
});
