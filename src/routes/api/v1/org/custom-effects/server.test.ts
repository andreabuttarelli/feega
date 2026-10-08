import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

import { GET, POST } from './+server';
import { PATCH, DELETE } from './[id]/+server';

const FRAG = 'vec4 effect(vec2 uv) { return texture2D(u_src, uv) * u_amount; }';
const AMOUNT = { key: 'amount', label: 'Amount', kind: 'number', min: 0, max: 2, step: 0.1, default: 1 };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'fx-1',
  org_id: 'org-1',
  name: 'vhs',
  version: 3,
  frag: FRAG,
  params: [AMOUNT],
  check_state: 'unchecked',
  check_problems: [],
  cost_ms: null,
  deleted_at: null,
  updated_at: '2026-10-08T00:00:00Z',
  ...over
});

let fake: FakeDb;

function caller(db: FakeDb) {
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: 'org-1', userId: 'user-1', db: db.db, writeAllowed: true } });
}

type Handler = (event: unknown) => Promise<Response>;

async function call(handler: unknown, method: string, body?: unknown, params: Record<string, string> = {}) {
  const url = new URL('https://feega.test/api/v1/org/custom-effects');
  const request = new Request(url, {
    method,
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const res = await (handler as Handler)({ request, url, params });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  fake = fakeDb({ effects: [row()] }, { filter: true });
  caller(fake);
});

describe('/api/v1/org/custom-effects', () => {
  it('lists the org effects, live only', async () => {
    const { res, body } = await call(GET, 'GET');

    expect(res.status).toBe(200);
    expect(body.effects).toEqual([expect.objectContaining({ id: 'fx-1', name: 'vhs', version: 3 })]);
    const select = fake.calls.find((c) => c.op === 'select')!;
    expect(select.filters).toEqual(expect.arrayContaining([['org_id', 'org-1'], ['deleted_at', null]]));
  });

  it('creates an effect stamped with org and actor', async () => {
    fake = fakeDb({ effects: [] });
    caller(fake);

    const { res, body } = await call(POST, 'POST', { name: 'glow', frag: FRAG, params: [AMOUNT] });

    expect(res.status).toBe(201);
    expect(body.effect.name).toBe('glow');
    const insert = fake.calls.find((c) => c.op === 'insert')!;
    expect(insert.payload).toEqual(expect.objectContaining({ org_id: 'org-1', actor_kind: 'user', actor_id: 'user-1', check_state: 'unchecked' }));
  });

  it('stores lint problems as a failed check, not a refusal', async () => {
    caller(fakeDb({ effects: [] }));

    const { res, body } = await call(POST, 'POST', { name: 'loop', frag: 'vec4 effect(vec2 uv) { while (true) {} return vec4(0.0); }', params: [] });

    expect(res.status).toBe(201);
    expect(body.effect.check.state).toBe('failed');
    expect(body.effect.check.problems.join(' ')).toMatch(/while/);
  });

  it('refuses an effect that breaks the schema', async () => {
    const { res } = await call(POST, 'POST', { name: 'Bad Name', frag: FRAG, params: [] });

    expect(res.status).toBe(400);
  });

  it('patches text at the expected version and bumps it', async () => {
    fake = fakeDb({ effects: [row()] }, { filter: true, mutate: true });
    caller(fake);

    const { res, body } = await call(PATCH, 'PATCH', { version: 3, edits: [{ find: 'u_amount', replace: '0.5' }] }, { id: 'fx-1' });

    expect(res.status).toBe(200);
    expect(body.effect.version).toBe(4);
    const update = fake.calls.find((c) => c.op === 'update')!;
    expect(update.filters).toEqual(expect.arrayContaining([['id', 'fx-1'], ['version', 3]]));
    expect((update.payload as { frag: string }).frag).toContain('* 0.5');
  });

  it('answers conflict on a stale version', async () => {
    const { res, body } = await call(PATCH, 'PATCH', { version: 2, params: [AMOUNT] }, { id: 'fx-1' });

    expect(res.status).toBe(409);
    expect(body.error).toBe('conflict');
  });

  it('refuses an edit whose find is absent', async () => {
    const { res } = await call(PATCH, 'PATCH', { version: 3, edits: [{ find: 'nope', replace: 'x' }] }, { id: 'fx-1' });

    expect(res.status).toBe(400);
  });

  it('soft deletes', async () => {
    const { res } = await call(DELETE, 'DELETE', undefined, { id: 'fx-1' });

    expect(res.status).toBe(200);
    const update = fake.calls.find((c) => c.op === 'update')!;
    expect(update.payload).toEqual(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(update.filters).toEqual(expect.arrayContaining([['org_id', 'org-1'], ['id', 'fx-1']]));
  });

  it('answers unavailable while the table is not migrated', async () => {
    const missing = fakeDb({});
    const from = missing.db.from.bind(missing.db);
    (missing.db as unknown as { from: unknown }).from = (table: string) => {
      const real = from(table) as unknown as Record<string, () => unknown>;
      return { ...real, select: () => ({ eq: () => ({ is: () => ({ order: async () => ({ data: null, error: { code: 'PGRST205' } }) }) }) }) };
    };
    caller(missing);

    const { res, body } = await call(GET, 'GET');

    expect(res.status).toBe(200);
    expect(body).toEqual({ effects: [], available: false });
  });
});
