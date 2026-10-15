import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { MotionFormat } from '$lib/motion/doc';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const NODE = '44444444-4444-4444-4444-444444444444';
const OTHER = '44444444-4444-4444-4444-444444444445';

const { USER, current } = vi.hoisted(() => ({
  USER: { id: '55555555-5555-5555-5555-555555555555', email: 'ada@x.it', created_at: '2026-01-01T00:00:00Z' },
  current: { db: null as unknown }
}));
const findCanvasForUser = vi.fn();
const registerUploadedAsset = vi.fn();

vi.mock('$lib/server/db/client', () => ({ createUserDb: () => current.db }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ org: { id: ORG }, role: 'owner' }] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: async () => ({ status: 402, data: { error: 'credits_exhausted' } }) }));
vi.mock('$lib/server/elevenlabs-config', () => ({ configuredAudioProvider: () => null }));
vi.mock('$lib/server/canvas/upload', async (original) => ({ ...(await original<object>()), registerUploadedAsset: (...a: unknown[]) => registerUploadedAsset(...a) }));
vi.mock('$lib/server/project-catalogue', () => ({ projectCatalogue: async () => ({}) }));
vi.mock('$lib/server/motion/still-export', () => ({ exportStill: () => new Promise(() => {}), drawStill: () => new Promise(() => {}) }));

const { actions } = await import('$lib/server/canvas/canvas-page');
const { GET, POST } = await import('./+server');

const canvasRow = { id: CANVAS, org_id: ORG, project_id: PROJECT, name: 'One', viewport: null, share_token: null, shared_at: null, deleted_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const nodeRow = (id: string, version: number, type = 'text', data: Record<string, unknown> = { prompt: 'a', status: 'idle' }) => ({
  id, org_id: ORG, project_id: PROJECT, canvas_id: CANVAS, type, display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data, version, deleted_at: null
});

function seed(): Db {
  let n = 0;
  const rows: Record<string, unknown[]> = {
    projects: [{ id: PROJECT, org_id: ORG, name: 'p', slug: 'p', brand_id: null, archived_at: null, mode: null }],
    canvases: [canvasRow],
    nodes: [nodeRow(NODE, 2), nodeRow(OTHER, 5, 'image', { prompt: 'b', status: 'idle' })],
    nodes_connections: [],
    canvas_events: [],
    motion_templates: [],
    motion_revisions: [],
    assets: []
  };
  return fakeDb(rows, { filter: true, mutate: true, store: true, newId: () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}` }).db;
}

type Answer = { status: number; data: unknown };

function formOf(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => fd.set(key, value));
  return fd;
}

const RANDOM_KEYS = new Set(['clipId']);

function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null, (key, inner) => (RANDOM_KEYS.has(key) ? 'random' : inner)));
}

async function viaAction(name: string, fields: Record<string, string>): Promise<Answer> {
  current.db = seed();
  const event = {
    request: { formData: async () => formOf(fields) },
    params: { projectId: PROJECT, canvasId: CANVAS },
    setHeaders: () => {},
    locals: { safeGetSession: async () => ({ session: {}, user: USER }), db: async () => current.db }
  };
  try {
    const out = (await (actions[name] as (e: unknown) => Promise<unknown>)(event)) as { status?: number; data?: unknown };
    if (out && typeof out === 'object' && 'status' in out && typeof out.status === 'number' && out.status >= 400 && out.constructor?.name === 'ActionFailure') {
      return { status: out.status, data: plain(out.data) };
    }
    return { status: 200, data: plain(out) };
  } catch (e) {
    const thrown = e as { status: number; body: { message: string } };
    return { status: thrown.status, data: { error: thrown.body.message } };
  }
}

async function viaEndpoint(name: string, fields: Record<string, string>, token = 'jwt'): Promise<Answer> {
  current.db = seed();
  const url = new URL(`https://feega.test/api/v1/projects/${PROJECT}/canvases/${CANVAS}?action=${name}`);
  const res = await (POST as (e: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: formOf(fields) }),
    url,
    params: { projectId: PROJECT, canvasId: CANVAS },
    setHeaders: () => {}
  });
  const body = (await res.json()) as { data?: unknown };
  return res.status === 200 ? { status: 200, data: plain(body.data) } : { status: res.status, data: body };
}

beforeEach(() => {
  vi.clearAllMocks();
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { id: CANVAS, projectId: PROJECT, name: 'One' }, mode: null, projectBrandId: null });
});

const DRAWN = { tool: 'rectangle', box: { left: 0, top: 0, width: 100, height: 80 } };

const CASES: { name: string; action: string; fields: Record<string, string>; status: number }[] = [
  { name: 'write lands a patch on its base', action: 'write', fields: { node_id: NODE, base: JSON.stringify({ prompt: 'a' }), patch: JSON.stringify({ prompt: 'b' }) }, status: 200 },
  { name: 'write on a stale base answers 409 with the conflict keys', action: 'write', fields: { node_id: NODE, base: JSON.stringify({ prompt: 'stale' }), patch: JSON.stringify({ prompt: 'b' }) }, status: 409 },
  { name: 'write on a missing node answers 404', action: 'write', fields: { node_id: 'missing', base: '{}', patch: '{}' }, status: 404 },
  { name: 'upload into the library registers only the asset', action: 'upload', fields: { into: 'library', path: `${ORG}/${PROJECT}/x.png`, file_name: 'x.png', mime_type: 'image/png', bytes: '10' }, status: 200 },
  { name: 'upload without a path answers 400', action: 'upload', fields: {}, status: 400 },
  { name: 'create places a node', action: 'create', fields: { type: 'text', x: '10', y: '20', data: JSON.stringify({ prompt: 'hi' }) }, status: 200 },
  { name: 'move moves a node', action: 'move', fields: { node_id: NODE, x: '5', y: '6' }, status: 200 },
  { name: 'move on a missing node answers 404', action: 'move', fields: { node_id: 'missing', x: '5', y: '6' }, status: 404 },
  { name: 'connect draws a line', action: 'connect', fields: { source_node_id: NODE, target_node_id: OTHER, kind: 'derives_from' }, status: 200 },
  { name: 'connect refuses a loop on itself', action: 'connect', fields: { source_node_id: NODE, target_node_id: NODE, kind: 'derives_from' }, status: 400 },
  { name: 'run stops at the credit gate', action: 'run', fields: { node_id: NODE, medium: 'text', prompt: 'x', version: '2' }, status: 402 },
  { name: 'frame_template lands a frame', action: 'frame_template', fields: { template: 'builtin:poster-type-grid', format: MotionFormat.Portrait, x: '0', y: '0' }, status: 200 },
  { name: 'template refuses an unknown template', action: 'template', fields: { template: 'nope', x: '0', y: '0' }, status: 400 },
  { name: 'audio_voices says voices are not configured', action: 'audio_voices', fields: {}, status: 503 },
  { name: 'apply_effects refuses a node that is not an effects node', action: 'apply_effects', fields: { node_id: NODE }, status: 400 },
  { name: 'effects_pair refuses a text node', action: 'effects_pair', fields: { node_id: NODE }, status: 400 },
  { name: 'drawElement draws a shape', action: 'drawElement', fields: { drawn: JSON.stringify(DRAWN) }, status: 200 },
  { name: 'groupElements refuses an unreadable group', action: 'groupElements', fields: {}, status: 400 },
  { name: 'ungroupElement refuses a missing id', action: 'ungroupElement', fields: {}, status: 400 },
  { name: 'placeOutput refuses an unreadable drop', action: 'placeOutput', fields: { source: NODE }, status: 400 },
  { name: 'moveElement refuses an unreadable move', action: 'moveElement', fields: {}, status: 400 }
];

describe('the canvas page action and its /api/v1 canvas endpoint answer the same', () => {
  it.each(CASES)('$name', async ({ action, fields, status }) => {
    registerUploadedAsset.mockResolvedValue({ asset: { id: 'a1' }, kind: 'image' });

    const page = await viaAction(action, fields);
    const api = await viaEndpoint(action, fields);

    expect(page.status).toBe(status);
    expect(api).toEqual(page);
  });

  it('a canvas that is not yours answers 404 with the page message', async () => {
    findCanvasForUser.mockResolvedValue(null);

    const page = await viaAction('move', { node_id: NODE, x: '1', y: '1' });
    const api = await viaEndpoint('move', { node_id: NODE, x: '1', y: '1' });

    expect(page.status).toBe(404);
    expect(api).toEqual(page);
  });

  it('an unknown action answers 404', async () => {
    expect((await viaEndpoint('explode', {})).status).toBe(404);
  });

  it('no valid bearer answers 401', async () => {
    expect((await viaEndpoint('move', {}, 'forged')).status).toBe(401);
  });
});

describe('GET /api/v1/projects/[projectId]/canvases/[canvasId]', () => {
  it('answers the page load', async () => {
    current.db = seed();
    const url = new URL(`https://feega.test/api/v1/projects/${PROJECT}/canvases/${CANVAS}`);
    const res = await (GET as (e: unknown) => Promise<Response>)({
      request: new Request(url, { headers: { authorization: 'Bearer jwt' } }),
      url,
      params: { projectId: PROJECT, canvasId: CANVAS },
      setHeaders: () => {}
    });
    const body = (await res.json()) as { data: { canvas: { id: string }; nodes: unknown[]; projectId: string } };

    expect(res.status).toBe(200);
    expect(body.data.canvas.id).toBe(CANVAS);
    expect(body.data.nodes).toHaveLength(2);
    expect(body.data.projectId).toBe(PROJECT);
  });
});
