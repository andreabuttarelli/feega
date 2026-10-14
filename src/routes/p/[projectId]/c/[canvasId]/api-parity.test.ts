import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const resolveOrgCaller = vi.fn();
const findCanvasForUser = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...a: unknown[]) => resolveOrgCaller(...a) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => undefined, gateOrgAiActionForForm: async () => undefined }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ org: { id: ORG_ID }, role: 'owner' }] }));
vi.mock('$lib/server/projects/lookup', () => ({ findProjectForUser: async () => null }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a) }));

import { actions } from './+page.server';
import { POST } from '../../../../api/v1/org/canvas/+server';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const NODE = '44444444-4444-4444-4444-444444444444';
const OTHER = '44444444-4444-4444-4444-444444444445';
const USER = '55555555-5555-5555-5555-555555555555';

const projectRow = { id: PROJECT, org_id: ORG, name: 'p', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01T00:00:00Z', mode: null };
const canvasRow = { id: CANVAS, org_id: ORG, project_id: PROJECT, name: 'One', share_token: null, shared_at: null, deleted_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const nodeRow = (id: string, version: number) => ({
  id,
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
  data: { prompt: 'a', status: 'idle' },
  version,
  deleted_at: null
});

type Seeded = { db: Db; rows: Record<string, unknown[]> };

function seed(): Seeded {
  const rows: Record<string, unknown[]> = {
    projects: [projectRow],
    canvases: [canvasRow],
    nodes: [nodeRow(NODE, 2), nodeRow(OTHER, 5)],
    nodes_connections: [],
    canvas_events: []
  };
  return { db: fakeDb(rows, { filter: true, mutate: true, store: true, newId: idSequence() }).db, rows };
}

function idSequence() {
  let n = 0;
  return () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`;
}

async function viaAction(name: keyof typeof actions, form: Record<string, string>) {
  const { db } = seed();
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: PROJECT }, mode: null, projectBrandId: null });
  const fd = new FormData();
  Object.entries(form).forEach(([k, v]) => fd.set(k, v));
  const out = await (actions[name] as (event: unknown) => Promise<unknown>)({
    request: { formData: async () => fd },
    params: { projectId: PROJECT, canvasId: CANVAS },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: USER, created_at: '2026-01-01' } }), db: async () => db }
  });
  return answerOf(out);
}

async function viaEndpoint(op: string, input: Record<string, unknown>) {
  const { db } = seed();
  resolveOrgCaller.mockResolvedValue({ caller: { db, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' } });
  const url = new URL('https://feega.test/api/v1/org/canvas');
  const res = await (POST as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ project_id: PROJECT, op, input }) }),
    url
  });
  return { status: res.status, data: JSON.parse(JSON.stringify(await res.json())) };
}

function answerOf(out: unknown) {
  const failed = out as { status?: number; data?: unknown };
  if (failed && typeof failed.status === 'number' && failed.status >= 400) {
    return { status: failed.status, data: failed.data };
  }
  return { status: 200, data: JSON.parse(JSON.stringify(out)) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the canvas page action and its /api/v1 op answer the same', () => {
  const items = [
    { node_id: NODE, version: 2, patch: { status: 'done' } },
    { node_id: OTHER, version: 4, patch: { status: 'done' } },
    { node_id: 'missing', version: 1, patch: {} }
  ];

  it('batchWrite and write_nodes', async () => {
    const action = await viaAction('batchWrite', { items: JSON.stringify(items) });
    const endpoint = await viaEndpoint('write_nodes', { canvasId: CANVAS, items });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  const pasted = {
    nodes: [
      { type: 'text', data: { prompt: 'a' }, x: 0, y: 0 },
      { type: 'text', data: { prompt: 'b' }, x: 10, y: 0 }
    ],
    edges: [{ sourceIndex: 0, targetIndex: 1, sourceHandle: null, targetHandle: null }]
  };

  it('paste and paste_nodes', async () => {
    const action = await viaAction('paste', { nodes: JSON.stringify(pasted.nodes), edges: JSON.stringify(pasted.edges) });
    const endpoint = await viaEndpoint('paste_nodes', { canvasId: CANVAS, ...pasted });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  it('paste_nodes refuses a canvas outside the project', async () => {
    const endpoint = await viaEndpoint('paste_nodes', { canvasId: 'elsewhere', ...pasted });

    expect(endpoint.data.error).toBe('canvas_not_found');
  });

  it('snapshot and canvas_snapshot', async () => {
    const action = await viaAction('snapshot', {});
    const endpoint = await viaEndpoint('canvas_snapshot', { canvasId: CANVAS });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  it('revision and canvas_revision', async () => {
    const action = await viaAction('revision', {});
    const endpoint = await viaEndpoint('canvas_revision', { canvasId: CANVAS });

    expect(action.data.kind).toBe('live');
    expect(endpoint).toEqual(action);
  });

  it('canvas_snapshot refuses a canvas outside the project', async () => {
    const endpoint = await viaEndpoint('canvas_snapshot', { canvasId: 'elsewhere' });

    expect(endpoint.data.error).toBe('canvas_not_found');
  });

  const gesture = [{ kind: 'node.create', nodeId: NODE, after: { prompt: 'a', status: 'idle' } }];

  it('undo and undo_gesture', async () => {
    const action = await viaAction('undo', { items: JSON.stringify(gesture) });
    const endpoint = await viaEndpoint('undo_gesture', { canvasId: CANVAS, items: gesture });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  it('undo refuses an unknown gesture through both doors', async () => {
    const bad = [{ kind: 'node.explode' }];
    const action = await viaAction('undo', { items: JSON.stringify(bad) });
    const endpoint = await viaEndpoint('undo_gesture', { canvasId: CANVAS, items: bad });

    expect(action.status).toBe(400);
    expect(endpoint.data.error).toBe('invalid_gesture');
  });

  it('demo_run and run_demo refuse an incomplete chain alike', async () => {
    const action = await viaAction('demo_run', {});
    const endpoint = await viaEndpoint('run_demo', { canvasId: CANVAS });

    expect(action).toEqual({ status: 400, data: { error: 'chain_incomplete' } });
    expect(endpoint.data.error).toBe('chain_incomplete');
  });

  it('onboarding_end and end_onboarding', async () => {
    const action = await viaAction('onboarding_end', { status: 'dismissed' });
    const endpoint = await viaEndpoint('end_onboarding', { status: 'dismissed' });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  it('estimate_text_cost and estimate_text_cost', async () => {
    const action = await viaAction('estimate_text_cost', { node_id: NODE, prompt: 'write a haiku', model: '' });
    const endpoint = await viaEndpoint('estimate_text_cost', { canvasId: CANVAS, nodeId: NODE, prompt: 'write a haiku' });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  it('suggestNextStep and suggest_next_steps', async () => {
    const action = await viaAction('suggestNextStep', { node_id: NODE });
    const endpoint = await viaEndpoint('suggest_next_steps', { canvasId: CANVAS, nodeId: NODE });

    expect(action.status).toBe(200);
    expect(endpoint).toEqual(action);
  });

  it('suggest_next_steps answers a missing node like the action', async () => {
    const action = await viaAction('suggestNextStep', { node_id: 'missing' });
    const endpoint = await viaEndpoint('suggest_next_steps', { canvasId: CANVAS, nodeId: 'missing' });

    expect(action.status).toBe(404);
    expect(endpoint.data.error).toBe('node_not_found');
  });
});
