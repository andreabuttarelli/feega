import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { createMemoryDb } from '$lib/server/local/memory-db';
import { createNode, findNode, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { listCanvasEvents } from '$lib/server/repos/canvas-events';

const ORG = 'org-1';
const CANVAS = 'c-1';
const PROJECT = 'p-1';
const MARCO = 'u-marco';
const SESSION = '6f1c2a9e-1b7d-4c3e-9a51-2f0e8d7c6b5a';

const state = vi.hoisted(() => ({ db: null as unknown, writeAllowed: true }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: MARCO, writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { POST } = await import('./+server');

async function seeded(): Promise<{ db: Db; nodeId: string; entryId: string }> {
  const db = createMemoryDb({ tables: new Map(), blobs: new Map(), user: { id: MARCO, email: 'm@b.c', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} }) as unknown as Db;
  await db.from('projects').insert({ id: PROJECT, org_id: ORG, name: 'P', mode: 'standard', brand_id: null } as never);
  await db.from('canvases').insert({ id: CANVAS, org_id: ORG, project_id: PROJECT, name: 'C', deleted_at: null } as never);
  const node = await createNode(db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, type: 'text', x: 0, y: 0, data: { prompt: 'first' }, actor: { kind: 'user', id: MARCO } });
  await patchNodeData(db, { orgId: ORG, nodeId: node.id, patch: { prompt: 'claude' }, check: DataCheck.None, actor: { kind: 'agent', id: MARCO, agentKey: 'claude-code' } });
  const [event] = await listCanvasEvents(db, { orgId: ORG, canvasId: CANVAS, limit: 1 });
  state.db = db;
  return { db, nodeId: node.id, entryId: `event:${event.id}` };
}

const post = (entryId: string, body: unknown = {}) => {
  const url = new URL(`https://feega.test/api/v1/canvas/${CANVAS}/history/${entryId}/revert`);
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t', 'x-feega-session': SESSION }, body: JSON.stringify(body) }), url, params: { canvasId: CANVAS, entryId, action: 'revert' } } as never);
};

describe('POST /api/v1/canvas/{id}/history/{entryId}/revert', () => {
  it('reverts the change and records the revert in the caller session', async () => {
    const { db, nodeId, entryId } = await seeded();

    const res = await post(entryId);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'rejected' });
    expect((await findNode(db, { orgId: ORG, nodeId }))!.data).toEqual({ prompt: 'first' });
    expect((await listCanvasEvents(db, { orgId: ORG, canvasId: CANVAS, limit: 1 }))[0]).toMatchObject({ sessionId: SESSION, agentKey: 'mcp' });
  });

  it('an unknown canvas or change answers not found', async () => {
    await seeded();

    expect(await (await post('event:999')).json()).toEqual({ outcome: 'not_found' });
  });

  it('a read-only key cannot revert', async () => {
    const { entryId } = await seeded();
    state.writeAllowed = false;

    const res = await post(entryId);
    state.writeAllowed = true;

    expect(res.status).toBe(403);
  });
});
