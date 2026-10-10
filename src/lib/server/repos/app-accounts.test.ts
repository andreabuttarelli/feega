import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { appAccountStore } from './app-accounts';

const SCOPE = { orgId: 'o1', projectId: 'p1', actor: { kind: 'agent' as const, id: 'u1', agentKey: 'project-agent' } };
const ROW = { login_url: 'https://app.example/login', email: 't@app.example', test_password: 'pw', session: { cookies: [{ name: 'sid' }], storage: { jwt: 't' } }, session_until: '1970-01-01T00:00:01.000Z' };

function fakeDb(answer: { data?: unknown; error?: { code?: string } | null }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'eq', 'upsert', 'delete', 'maybeSingle']) {
    chain[op] = vi.fn((...args: unknown[]) => {
      calls.push({ op, args });
      return chain;
    });
  }
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: answer.data ?? null, error: answer.error ?? null });
  return { db: { from: vi.fn(() => chain) } as unknown as Db, calls };
}

describe('app accounts: one test account per project', () => {
  it('reads the row of the project as an account', async () => {
    const { db, calls } = fakeDb({ data: ROW });

    expect(await appAccountStore(db, SCOPE).read()).toEqual({ loginUrl: ROW.login_url, email: ROW.email, password: 'pw', session: { cookies: [{ name: 'sid' }], storage: { jwt: 't' } }, sessionUntil: 1000 });
    expect(calls).toContainEqual({ op: 'eq', args: ['project_id', 'p1'] });
    expect(calls).toContainEqual({ op: 'eq', args: ['org_id', 'o1'] });
  });

  it('a table not migrated yet reads as no account', async () => {
    const { db } = fakeDb({ error: { code: '42P01' } });

    expect(await appAccountStore(db, SCOPE).read()).toBeNull();
  });

  it('saves the account with who wrote it, keyed on the project', async () => {
    const { db, calls } = fakeDb({});

    await appAccountStore(db, SCOPE).save({ loginUrl: ROW.login_url, email: ROW.email, password: 'pw', session: { cookies: [], storage: {} }, sessionUntil: null });

    expect(calls.find((c) => c.op === 'upsert')?.args[0]).toMatchObject({ project_id: 'p1', org_id: 'o1', test_password: 'pw', session_until: null, actor_kind: 'agent', actor_id: 'u1', agent_key: 'project-agent' });
  });

  it('forgets the account of the project only', async () => {
    const { db, calls } = fakeDb({});

    await appAccountStore(db, SCOPE).forget();

    expect(calls.map((c) => c.op)).toEqual(['delete', 'eq', 'eq']);
  });
});
