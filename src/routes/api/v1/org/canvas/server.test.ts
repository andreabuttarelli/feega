import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();
const gateOrgAiAction = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/cli-auth', () => ({
  gateOrgAiAction: (...args: unknown[]) => gateOrgAiAction(...args)
}));

vi.mock('$lib/server/canvas-catalogue', () => {
  const none = { choices: [], recommended: [], synced: true };
  return { canvasModelCatalogue: async () => ({ text: none, image: none, video: none, audio: none, model3d: none }) };
});
vi.mock('$lib/server/ai-models-sync', () => ({ modalitiesOf: async () => [] }));

import { POST } from './+server';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const NODE = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';

const projectRow = { id: PROJECT, org_id: ORG, name: 'p', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01T00:00:00Z', mode: null };
const nodeRow = {
  id: NODE,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type: 'text',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: { prompt: 'ciao' },
  version: 3,
  deleted_at: null
};

function caller(db: unknown, writeAllowed = true) {
  resolveOrgCaller.mockResolvedValue({ caller: { db, orgId: ORG, userId: USER, writeAllowed, apiKeyId: 'key-1' } });
}

async function call(body: unknown) {
  const url = new URL('https://feega.test/api/v1/org/canvas');
  const res = await (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }),
    url
  });
  return { res, body: await res.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  gateOrgAiAction.mockResolvedValue(undefined);
});

describe('POST /api/v1/org/canvas — the chat canvas ops, for CLI and MCP', () => {
  it('lists the nodes of a canvas through the same op the chat uses', async () => {
    const { db } = fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true });
    caller(db);

    const { res, body } = await call({ project_id: PROJECT, op: 'list_nodes', input: { canvasId: CANVAS } });

    expect(res.status).toBe(200);
    expect(body.nodes.map((n: { id: string }) => n.id)).toEqual([NODE]);
  });

  it('creates a node on the project, signed as the agent of the caller', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true });
    caller(db);

    const { res, body } = await call({ project_id: PROJECT, op: 'create_node', input: { canvasId: CANVAS, type: 'text', x: 1, y: 2, data: { prompt: 'p' } } });

    expect(res.status).toBe(200);
    expect(body.outcome).toBe('written');
    const insert = calls.find((c) => c.op === 'insert' && c.table === 'nodes')!;
    expect(insert.payload).toMatchObject({ org_id: ORG, project_id: PROJECT, actor_kind: 'agent', actor_id: USER });
  });

  it('a frame created through create_node gets the size of its format, not none', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true });
    caller(db);

    await call({ project_id: PROJECT, op: 'create_node', input: { canvasId: CANVAS, type: 'motion', x: 1, y: 2, data: { format: '9:16', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } });

    const insert = calls.find((c) => c.op === 'insert' && c.table === 'nodes')!;
    expect(insert.payload).toMatchObject({ width: 288, height: 512 });
  });

  it('draws a frame at the box asked, the same frame the canvas draws', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow], canvases: [{ id: CANVAS, org_id: ORG, project_id: PROJECT }] }, { filter: true });
    caller(db);

    const { res } = await call({ project_id: PROJECT, op: 'draw_frame', input: { canvasId: CANVAS, x: 10, y: 20, w: 720, h: 450 } });

    expect(res.status).toBe(200);
    const insert = calls.find((c) => c.op === 'insert' && c.table === 'nodes')!;
    expect(insert.payload).toMatchObject({ type: 'motion', x: 10, y: 20, width: 720, height: 450 });
  });

  it('refuses an op it does not know, naming the ones it does', async () => {
    caller(fakeDb({ projects: [projectRow] }, { filter: true }).db);

    const { res, body } = await call({ project_id: PROJECT, op: 'drop_table', input: {} });

    expect(res.status).toBe(400);
    expect(body.error).toBe('unknown_op');
    expect(body.ops).toContain('create_node');
  });

  it('refuses input that does not match the op schema', async () => {
    caller(fakeDb({ projects: [projectRow] }, { filter: true }).db);

    const { res, body } = await call({ project_id: PROJECT, op: 'move_node', input: { nodeId: NODE } });

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_input');
  });

  it('a project of another org is not found', async () => {
    caller(fakeDb({ projects: [] }, { filter: true }).db);

    const { res, body } = await call({ project_id: PROJECT, op: 'list_canvases', input: {} });

    expect(res.status).toBe(404);
    expect(body.error).toBe('project_not_found');
  });

  it('a read-only key reads but never writes', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true });
    caller(db, false);

    const read = await call({ project_id: PROJECT, op: 'list_nodes', input: { canvasId: CANVAS } });
    const write = await call({ project_id: PROJECT, op: 'delete_node', input: { nodeId: NODE } });

    expect(read.res.status).toBe(200);
    expect(write.res.status).toBe(403);
    expect(calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('an op that spends passes the credit gate first, and stops on it', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true });
    caller(db);
    gateOrgAiAction.mockResolvedValue(new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402 }));

    const { res } = await call({ project_id: PROJECT, op: 'run_node', input: { nodeId: NODE, medium: 'text', expectedVersion: 3 } });

    expect(res.status).toBe(402);
    expect(calls.some((c) => c.table === 'node_runs')).toBe(false);
  });

  it('previewing a loop is a read: no gate, no write', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow], nodes_connections: [] }, { filter: true });
    caller(db, false);

    const { res, body } = await call({ project_id: PROJECT, op: 'preview_node_loop', input: { nodeId: NODE } });

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('safety');
    expect(gateOrgAiAction).not.toHaveBeenCalled();
    expect(calls.some((c) => c.op === 'insert' || c.op === 'update')).toBe(false);
  });

  it('queueing a loop spends, so it passes the credit gate', async () => {
    caller(fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true }).db);
    gateOrgAiAction.mockResolvedValue(new Response('{}', { status: 402 }));

    const { res } = await call({ project_id: PROJECT, op: 'run_node_loop', input: { nodeId: NODE } });

    expect(res.status).toBe(402);
  });

  it('quotes a downstream run without spending or queueing', async () => {
    const { db, calls } = fakeDb({ projects: [projectRow], nodes: [nodeRow], nodes_connections: [] }, { filter: true });
    caller(db, false);

    const { res, body } = await call({ project_id: PROJECT, op: 'preview_run_graph', input: { graph: 'downstream', nodeId: NODE } });

    expect(res.status).toBe(200);
    expect(body.steps).toEqual([{ nodeId: NODE, dependsOn: [] }]);
    expect(body.credits).toBeGreaterThan(0);
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('running the graph spends, so it passes the credit gate', async () => {
    caller(fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true }).db);
    gateOrgAiAction.mockResolvedValue(new Response('{}', { status: 402 }));

    const { res } = await call({ project_id: PROJECT, op: 'run_graph', input: { graph: 'stale', canvasId: CANVAS } });

    expect(res.status).toBe(402);
  });

  it('reads never touch the credit gate', async () => {
    caller(fakeDb({ projects: [projectRow], nodes: [nodeRow] }, { filter: true }).db);

    await call({ project_id: PROJECT, op: 'list_nodes', input: { canvasId: CANVAS } });

    expect(gateOrgAiAction).not.toHaveBeenCalled();
  });

  it('refuses a canvas of an uncensored project the caller has not unlocked, like the page does', async () => {
    const { db } = fakeDb({ projects: [{ ...projectRow, mode: 'uncensored' }], nodes: [nodeRow] }, { filter: true });
    caller(db);

    const { res, body } = await call({ project_id: PROJECT, op: 'list_nodes', input: { canvasId: CANVAS } });

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'project_not_found' });
  });
});
