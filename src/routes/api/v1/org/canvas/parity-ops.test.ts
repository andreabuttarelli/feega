import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => undefined }));

import { POST } from './+server';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const OTHER_CANVAS = '33333333-3333-3333-3333-333333333334';
const SOURCE = '44444444-4444-4444-4444-444444444444';
const TARGET = '44444444-4444-4444-4444-444444444445';
const EDGE = '66666666-6666-6666-6666-666666666666';
const USER = '55555555-5555-5555-5555-555555555555';

const projectRow = { id: PROJECT, org_id: ORG, name: 'p', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01T00:00:00Z', mode: null };
const canvasRow = (id: string, name: string) => ({ id, org_id: ORG, project_id: PROJECT, name, share_token: null, shared_at: null, deleted_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' });
const nodeRow = (id: string, type = 'text', data: Record<string, unknown> = { prompt: 'p' }) => ({
  id,
  org_id: ORG,
  project_id: PROJECT,
  canvas_id: CANVAS,
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data,
  version: 1,
  deleted_at: null
});
const edgeRow = { id: EDGE, org_id: ORG, canvas_id: CANVAS, source_node_id: SOURCE, target_node_id: TARGET, source_handle: null, target_handle: null, mode: 'fixed', deleted_at: null };

function seed() {
  const faked = fakeDb(
    { projects: [projectRow], canvases: [canvasRow(CANVAS, 'One'), canvasRow(OTHER_CANVAS, 'Two')], nodes: [nodeRow(SOURCE), nodeRow(TARGET)], nodes_connections: [edgeRow], canvas_events: [] },
    { filter: true }
  );
  resolveOrgCaller.mockResolvedValue({ caller: { db: faked.db, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' } });
  return faked;
}

async function call(op: string, input: Record<string, unknown>) {
  const url = new URL('https://feega.test/api/v1/org/canvas');
  const res = await (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ project_id: PROJECT, op, input }) }),
    url
  });
  return { status: res.status, body: await res.json() };
}

const updatesOf = (calls: { op: string; table: string; payload?: unknown }[], table: string) => calls.filter((c) => c.op === 'update' && c.table === table);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canvas_tool does what the canvas UI does', () => {
  it('delete_node drops the lines that touch the node, like the canvas Delete', async () => {
    const { calls } = seed();

    const { status, body } = await call('delete_node', { nodeId: SOURCE });

    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(updatesOf(calls, 'nodes_connections').some((c) => (c.payload as { deleted_at?: unknown }).deleted_at)).toBe(true);
  });

  it('rename_canvas renames a canvas of this project', async () => {
    const { calls } = seed();

    const { body } = await call('rename_canvas', { canvasId: CANVAS, name: 'Launch' });

    expect(body.renamed).toBe(true);
    expect(updatesOf(calls, 'canvases')[0]?.payload).toMatchObject({ name: 'Launch' });
  });

  it('rename_canvas refuses a canvas outside the project', async () => {
    seed();

    const { body } = await call('rename_canvas', { canvasId: 'elsewhere', name: 'x' });

    expect(body.error).toBe('canvas_not_found');
  });

  it('delete_canvas removes one and names the canvas left', async () => {
    seed();

    const { body } = await call('delete_canvas', { canvasId: CANVAS });

    expect(body).toEqual({ deleted: true, nextCanvasId: OTHER_CANVAS });
  });

  it('disconnect_nodes soft-deletes the line', async () => {
    const { calls } = seed();

    const { body } = await call('disconnect_nodes', { connectionId: EDGE });

    expect(body.disconnected).toBe(true);
    expect(updatesOf(calls, 'nodes_connections')[0]?.payload).toHaveProperty('deleted_at');
  });

  it('set_edge_mode turns a line into a loop axis', async () => {
    const { calls } = seed();

    await call('set_edge_mode', { connectionId: EDGE, mode: 'iterate' });

    expect(updatesOf(calls, 'nodes_connections')[0]?.payload).toEqual({ mode: 'iterate' });
  });

  it('resize_node never shrinks a node under the size it is born with', async () => {
    const { calls } = seed();

    await call('resize_node', { nodeId: SOURCE, width: 1, height: 1 });

    const size = updatesOf(calls, 'nodes')[0]?.payload as { width: number; height: number };
    expect(size.width).toBeGreaterThan(1);
    expect(size.height).toBeGreaterThan(1);
  });

  it('share_canvas mints a view-only link and revokes it', async () => {
    seed();

    const on = await call('share_canvas', { canvasId: CANVAS, on: true });
    const off = await call('share_canvas', { canvasId: CANVAS, on: false });

    expect(on.body.path).toMatch(/^\/s\/.+/);
    expect(off.body).toEqual({ shared: false });
  });

  it('list_templates names the canvas templates insert_template takes', async () => {
    seed();

    const { body } = await call('list_templates', {});

    expect(body.templates.length).toBeGreaterThan(0);
    expect(body.templates[0]).toHaveProperty('id');
  });

  it('insert_template refuses an unknown template', async () => {
    seed();

    const { body } = await call('insert_template', { canvasId: CANVAS, templateId: 'nope', x: 0, y: 0 });

    expect(body.error).toBe('unknown_template');
  });

  it('sync_node refuses a node that has nothing to sync', async () => {
    seed();

    const { body } = await call('sync_node', { nodeId: SOURCE });

    expect(body.error).toBe('not_syncable');
  });
});
