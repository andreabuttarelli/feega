import { describe, expect, it, vi } from 'vitest';
import { ensureDemoUser, ensureOrg, ensureCanvas, ensureDemoFrame, ensureCredits } from './db-seed.mjs';

describe('ensureDemoUser', () => {
  it('returns the id from a successful admin create', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'user-1' }) }));
    const user = await ensureDemoUser('http://gotrue', 'key', 'demo@feega.local', 'pw', fetchImpl as any);
    expect(user).toEqual({ id: 'user-1', created: true });
  });

  it('finds the existing user when create fails, so a re-seed is idempotent', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'already exists' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'user-1', email: 'demo@feega.local' }] }) });
    const user = await ensureDemoUser('http://gotrue', 'key', 'demo@feega.local', 'pw', fetchImpl as any);
    expect(user).toEqual({ id: 'user-1', created: false });
  });
});

function fakeClient(rowsBySql: Record<string, unknown[]>) {
  const calls: { sql: string; params: unknown[] }[] = [];
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      const key = Object.keys(rowsBySql).find((prefix) => sql.trimStart().startsWith(prefix));
      return { rows: key ? rowsBySql[key] : [] };
    }
  };
}

describe('seed idempotency', () => {
  it('reuses the org the user already owns instead of inserting another', async () => {
    const client = fakeClient({ 'select org_id from orgs_members': [{ org_id: 'org-1' }] });
    expect(await ensureOrg(client as any, 'user-1', 'Demo', 'demo')).toBe('org-1');
    expect(client.calls.some((c) => c.sql.startsWith('insert'))).toBe(false);
  });

  it('reuses the live canvas of the project', async () => {
    const client = fakeClient({ 'select id from canvases': [{ id: 'canvas-1' }] });
    expect(await ensureCanvas(client as any, 'org-1', 'project-1', 'Hello')).toBe('canvas-1');
    expect(client.calls.some((c) => c.sql.startsWith('insert'))).toBe(false);
  });

  it('does not add a second demo frame', async () => {
    const client = fakeClient({ 'select id from nodes': [{ id: 'node-1' }] });
    const place = { orgId: 'org-1', projectId: 'project-1', canvasId: 'canvas-1' };
    expect(await ensureDemoFrame(client as any, place, 'user-1', {})).toBe('node-1');
    expect(client.calls.some((c) => c.sql.startsWith('insert'))).toBe(false);
  });

  it('writes the frame as a motion node with its first revision', async () => {
    const client = fakeClient({ 'insert into nodes': [{ id: 'node-9' }] });
    const place = { orgId: 'org-1', projectId: 'project-1', canvasId: 'canvas-1' };
    await ensureDemoFrame(client as any, place, 'user-1', { version: 5 });
    const inserts = client.calls.filter((c) => c.sql.startsWith('insert')).map((c) => c.sql.split(' ').slice(0, 3).join(' '));
    expect(inserts).toEqual(['insert into nodes', 'insert into motion_revisions']);
  });

  it('grants starting credits once', async () => {
    const client = fakeClient({ 'select 1 from credit_ledger': [{ '?column?': 1 }] });
    await ensureCredits(client as any, 'org-1');
    expect(client.calls.some((c) => c.sql.startsWith('insert'))).toBe(false);
  });
});
