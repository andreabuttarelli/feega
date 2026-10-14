import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { diffDoc } from '$lib/motion/doc-ops';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const NODE = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';

const resolveOrgCaller = vi.fn();
const reachable = vi.fn(async () => true);
const gate = vi.fn(async () => undefined as unknown);

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...a: unknown[]) => resolveOrgCaller(...a) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => gate(), gateOrgAiActionForForm: async () => gate() }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ org: { id: ORG }, role: 'owner' }] }));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: async () => ({ orgId: ORG, canvas: { id: CANVAS, projectId: PROJECT, name: 'C', viewport: null }, mode: 'standard', projectBrandId: null })
}));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: () => reachable() }));

const { actions } = await import('./+page.server');
const { POST } = await import('../../../../../../api/v1/motion/[nodeId]/ops/+server');

const nodeRow = { id: NODE, org_id: ORG, project_id: PROJECT, canvas_id: CANVAS, type: 'motion', display_name: 'V', x: 0, y: 0, z: 0, width: null, height: null, data: {}, version: 1, deleted_at: null };

const start = () => {
  const made = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a');
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
};

const retexted = () => {
  const doc = start();
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: { ...c.props, text: 'b' } })) })) };
};

const revision = { org_id: ORG, node_id: NODE, version: 1, doc: start(), actor_kind: 'user', actor_id: USER, agent_key: null, summary: null, created_at: '2026-10-01T00:00:00Z' };

function seed(): Db {
  const rows: Record<string, unknown[]> = { nodes: [nodeRow], motion_revisions: [revision], node_runs: [], assets: [] };
  return fakeDb(rows, { filter: true, mutate: true, store: true }).db;
}

function answerOf(out: unknown) {
  const failed = out as { status?: number; data?: unknown };
  if (failed && typeof failed.status === 'number' && failed.status >= 400) {
    return { status: failed.status, data: failed.data };
  }
  return { status: 200, data: JSON.parse(JSON.stringify(out)) };
}

async function viaAction(name: keyof typeof actions, form: Record<string, string | string[]>) {
  const db = seed();
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) {
    (Array.isArray(v) ? v : [v]).forEach((one) => fd.append(k, one));
  }
  const out = await (actions[name] as (event: unknown) => Promise<unknown>)({
    request: { formData: async () => fd },
    params: { projectId: PROJECT, canvasId: CANVAS, nodeId: NODE },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: USER } }), db: async () => db }
  });
  return answerOf(out);
}

async function viaEndpoint(op: string, input: Record<string, unknown>, writeAllowed = true) {
  const db = seed();
  resolveOrgCaller.mockResolvedValue({ caller: { db, orgId: ORG, userId: USER, writeAllowed, apiKeyId: 'key-1' } });
  const url = new URL(`https://feega.test/api/v1/motion/${NODE}/ops`);
  const res = await (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ op, input }) }),
    params: { nodeId: NODE },
    url
  });
  return { status: res.status, data: JSON.parse(JSON.stringify(await res.json())) };
}

beforeEach(() => {
  vi.clearAllMocks();
  reachable.mockResolvedValue(true);
  gate.mockResolvedValue(undefined);
});

describe('the frame editor action and its /api/v1 op answer the same', () => {
  it('head and read_head', async () => {
    const action = await viaAction('head', {});
    const endpoint = await viaEndpoint('read_head', {});

    expect(action.status).toBe(200);
    expect(action.data.version).toBe(1);
    expect(endpoint).toEqual(action);
  });

  it('save and save_doc', async () => {
    const doc = retexted();
    const action = await viaAction('save', { version: '1', doc: JSON.stringify(doc), summary: 's' });
    const endpoint = await viaEndpoint('save_doc', { version: 1, doc, summary: 's' });

    expect(action).toEqual({ status: 200, data: { version: 2 } });
    expect(endpoint).toEqual(action);
  });

  it('save and save_doc refuse a doc that is not a motion doc', async () => {
    const action = await viaAction('save', { version: '1', doc: '"nope"' });
    const endpoint = await viaEndpoint('save_doc', { version: 1, doc: 'nope' });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });

  it('ops and apply_ops', async () => {
    const ops = diffDoc(start(), retexted());
    const action = await viaAction('ops', { version: '1', ops: JSON.stringify(ops), summary: 'x' });
    const endpoint = await viaEndpoint('apply_ops', { version: 1, ops, summary: 'x' });

    expect(action.status).toBe(200);
    expect(action.data.version).toBe(2);
    expect(endpoint).toEqual(action);
  });

  it('ops and apply_ops refuse what is not a list of ops', async () => {
    const action = await viaAction('ops', { version: '1', ops: '{"kind":"nope"}' });
    const endpoint = await viaEndpoint('apply_ops', { version: 1, ops: { kind: 'nope' } });

    expect(action).toEqual({ status: 400, data: { error: 'invalid_ops' } });
    expect(endpoint).toEqual(action);
  });

  it('renderStatus and render_status', async () => {
    const action = await viaAction('renderStatus', {});
    const endpoint = await viaEndpoint('render_status', {});

    expect(action).toEqual({ status: 200, data: { render: null } });
    expect(endpoint).toEqual(action);
  });

  it('batchStatus and batch_status', async () => {
    const action = await viaAction('batchStatus', {});
    const endpoint = await viaEndpoint('batch_status', {});

    expect(action).toEqual({ status: 200, data: { batch: null } });
    expect(endpoint).toEqual(action);
  });
});

describe('POST /api/v1/motion/[nodeId]/ops guards like the page', () => {
  it('refuses a frame on a canvas the caller has not unlocked', async () => {
    reachable.mockResolvedValue(false);

    const endpoint = await viaEndpoint('read_head', {});

    expect(endpoint).toEqual({ status: 404, data: { error: 'motion_node_not_found' } });
  });

  it('refuses a write with a read-only key', async () => {
    const endpoint = await viaEndpoint('save_doc', { version: 1, doc: retexted() }, false);

    expect(endpoint).toEqual({ status: 403, data: { error: 'api_key_read_only' } });
  });

  it('names the ops it has when asked for another', async () => {
    const endpoint = await viaEndpoint('nope', {});

    expect(endpoint.status).toBe(400);
    expect(endpoint.data.error).toBe('unknown_op');
  });
});
