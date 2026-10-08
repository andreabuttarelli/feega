import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EFFECTS } from '$lib/canvas/effects';
import { fakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

import { GET } from './+server';

function call() {
  const url = new URL('https://feega.test/api/v1/org/effects');
  return (GET as (event: unknown) => Promise<Response>)({
    request: new Request(url, { headers: { authorization: 'Bearer token' } }),
    url
  }).then(async (res) => ({ res, body: await res.json() }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', db: fakeDb({ effects: [] }).db } });
});

describe('GET /api/v1/org/effects', () => {
  it('lists every effect of the table with its params', async () => {
    const { res, body } = await call();

    expect(res.status).toBe(200);
    expect(body.effects.map((e: { id: string }) => e.id).sort()).toEqual(Object.keys(EFFECTS).sort());
  });

  it('lists the custom effects of the workspace beside the built-ins, with the step that uses each', async () => {
    const row = { id: 'fx-1', org_id: 'org-1', name: 'vhs', version: 2, frag: 'f', params: [], check_state: 'passed', check_problems: [], cost_ms: 3, deleted_at: null, updated_at: 'now' };
    resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', db: fakeDb({ effects: [row] }, { filter: true }).db } });

    const { body } = await call();

    expect(body.custom).toEqual([expect.objectContaining({ effect_id: 'fx-1', name: 'vhs', version: 2, state: 'passed', step: { id: 'custom', ref: 'fx-1' } })]);
  });

  it('refuses without a caller', async () => {
    resolveOrgCaller.mockResolvedValue({ error: { status: 401, body: { error: 'unauthorized' } } });

    const { res } = await call();

    expect(res.status).toBe(401);
  });
});
