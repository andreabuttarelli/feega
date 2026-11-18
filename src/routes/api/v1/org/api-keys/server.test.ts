import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const state = vi.hoisted(() => ({ world: null as null | FakeDb, role: 'member' as string | null }));

vi.mock('$lib/server/cli-auth', async (original) => ({
  ...(await original<typeof import('$lib/server/cli-auth')>()),
  openOrg: async () => ({ call: { supabase: state.world!.db, user: { id: 'u-1' }, orgId: 'org-1' } })
}));

const list = await import('./+server');
const one = await import('./[id]/+server');

const KEY = { id: 'k-1', user_id: 'u-1', name: 'Agent', key_prefix: 'feega_ab', scopes: ['read'], created_at: '2026-10-01', last_used_at: null };

beforeEach(() => {
  state.role = 'member';
  state.world = fakeDb(
    { api_keys: [{ ...KEY, org_id: 'org-1' }, { ...KEY, id: 'k-2', org_id: 'org-2' }], orgs_members: [{ org_id: 'org-1', user_id: 'u-1', role: state.role }].filter((m) => m.role) },
    { filter: true, newId: () => 'k-new' }
  );
});

const req = (method: string, body?: unknown) =>
  new Request('https://feega.app/api/v1/org/api-keys', { method, body: body ? JSON.stringify(body) : undefined, headers: { authorization: 'Bearer t' } });

describe('the org api-keys API', () => {
  it('lists the keys of the org, with their scopes', async () => {
    const res = await list.GET({ request: req('GET') } as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.keys.map((k: { id: string }) => k.id)).toEqual(['k-1']);
    expect(body.keys[0].scopes).toEqual(['read']);
  });

  it('mints a key on the org with the requested scopes', async () => {
    const res = await list.POST({ request: req('POST', { name: 'CI', scopes: ['read', 'write'] }) } as never);

    expect(res.status).toBe(201);
    const insert = state.world!.calls.find((c) => c.table === 'api_keys' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ org_id: 'org-1', user_id: 'u-1', name: 'CI', scopes: ['read', 'write'] });
  });

  it('revokes a key of the org, and refuses one of another org', async () => {
    const other = await one.DELETE({ request: req('DELETE'), params: { id: 'k-2' } } as never);
    const own = await one.DELETE({ request: req('DELETE'), params: { id: 'k-1' } } as never);

    expect(other.status).toBe(404);
    expect(own.status).toBe(200);
  });

  it.each(['owner', 'admin', 'member'])('mints for a %s', async (role) => {
    state.role = role;
    state.world = fakeDb({ api_keys: [], orgs_members: [{ org_id: 'org-1', user_id: 'u-1', role }] }, { filter: true, newId: () => 'k-new' });

    const res = await list.POST({ request: req('POST', { scopes: ['read', 'write'] }) } as never);

    expect(res.status).toBe(201);
  });

  it.each([
    ['a viewer', 'viewer'],
    ['a member demoted to viewer', 'viewer'],
    ['a member removed from the org', null]
  ])('refuses %s, and stores nothing', async (_who, role) => {
    state.world = fakeDb({ api_keys: [], orgs_members: role ? [{ org_id: 'org-1', user_id: 'u-1', role }] : [] }, { filter: true, newId: () => 'k-new' });

    const res = await list.POST({ request: req('POST', { scopes: ['read', 'write'] }) } as never);

    expect(res.status).toBe(403);
    expect(state.world.calls.some((c) => c.table === 'api_keys' && c.op === 'insert')).toBe(false);
  });
});
