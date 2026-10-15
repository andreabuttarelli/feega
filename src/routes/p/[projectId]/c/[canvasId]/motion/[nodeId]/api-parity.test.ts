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

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...a: unknown[]) => resolveOrgCaller(...a) }));
const gated = { value: false };
vi.mock('$lib/server/credits', async (real) => {
  const actual = await real<typeof import('$lib/server/credits')>();
  return {
    ...actual,
    gateOrgCredits: async () => {
      if (gated.value) {
        throw new actual.CreditsExhaustedError({} as never);
      }
    }
  };
});
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ org: { id: ORG }, role: 'owner' }] }));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: async () => ({ orgId: ORG, canvas: { id: CANVAS, projectId: PROJECT, name: 'C', viewport: null }, mode: 'standard', projectBrandId: null })
}));
vi.mock('$lib/server/canvas/sign-media', async (real) => ({ ...(await real<object>()), createAssetSigningDb: () => ({}), signAssetPaths: async () => new Map() }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: () => reachable() }));

const { actions, load } = await import('./+page.server');
const { POST } = await import('../../../../../../api/v1/motion/[nodeId]/ops/+server');
const { POST: POST_POSTER } = await import('../../../../../../api/v1/motion/[nodeId]/poster/+server');

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
  gated.value = false;
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

describe('the frame editor file and template actions answer like their ops', () => {
  it('exported and record_export refuse a path outside the export folder', async () => {
    const action = await viaAction('exported', { path: 'elsewhere/x.mp4', width: '1920', height: '1080', seconds: '3' });
    const endpoint = await viaEndpoint('record_export', { path: 'elsewhere/x.mp4', width: 1920, height: 1080, seconds: 3 });

    expect(action).toEqual({ status: 400, data: { error: 'invalid_path' } });
    expect(endpoint).toEqual(action);
  });

  it('uploadFont and upload_font refuse a path that is not an upload', async () => {
    const action = await viaAction('uploadFont', { path: 'elsewhere/f.woff2' });
    const endpoint = await viaEndpoint('upload_font', { path: 'elsewhere/f.woff2' });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });

  it('analyze and analyze_sounds', async () => {
    const action = await viaAction('analyze', { assetId: [] });
    const endpoint = await viaEndpoint('analyze_sounds', { assetIds: [] });

    expect(action).toEqual({ status: 200, data: { analyses: {} } });
    expect(endpoint).toEqual(action);
  });

  it('saveTemplate and save_template refuse what is not a motion doc', async () => {
    const action = await viaAction('saveTemplate', { doc: '"nope"', name: 'T', description: '', posterFrame: '0' });
    const endpoint = await viaEndpoint('save_template', { doc: 'nope', name: 'T', description: '', posterFrame: 0 });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });

  it('saveTemplate and save_template refuse a video with no exposed field', async () => {
    const action = await viaAction('saveTemplate', { doc: JSON.stringify(start()), name: 'T', description: '', posterFrame: '0' });
    const endpoint = await viaEndpoint('save_template', { doc: start(), name: 'T', description: '', posterFrame: 0 });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });

  it('templateSounds and template_sounds refuse what is not a motion doc', async () => {
    const action = await viaAction('templateSounds', { doc: '"nope"', clipId: 'a' });
    const endpoint = await viaEndpoint('template_sounds', { doc: 'nope', clipId: 'a' });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });

  it('templateSounds and template_sounds on a clip that is no template', async () => {
    const action = await viaAction('templateSounds', { doc: JSON.stringify(start()), clipId: 'a' });
    const endpoint = await viaEndpoint('template_sounds', { doc: start(), clipId: 'a' });

    expect(endpoint).toEqual(action);
  });
});

async function viaPosterEndpoint(form: FormData, writeAllowed = true) {
  const db = seed();
  resolveOrgCaller.mockResolvedValue({ caller: { db, orgId: ORG, userId: USER, writeAllowed, apiKeyId: 'key-1' } });
  const url = new URL(`https://feega.test/api/v1/motion/${NODE}/poster`);
  const res = await (POST_POSTER as (event: unknown) => Promise<Response>)({
    request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: form }),
    params: { nodeId: NODE },
    url
  });
  return { status: res.status, data: JSON.parse(JSON.stringify(await res.json())) };
}

describe('the poster action and POST /api/v1/motion/[nodeId]/poster answer the same', () => {
  it('both refuse a poster that is not a jpeg or png', async () => {
    const form = new FormData();
    form.set('file', new File(['x'], 'p.gif', { type: 'image/gif' }));

    const action = await viaAction('poster', { width: '10', height: '10' });
    const endpoint = await viaPosterEndpoint(form);

    expect(action).toEqual({ status: 400, data: { error: 'invalid_poster' } });
    expect(endpoint).toEqual(action);
  });

  it('refuses a read-only key', async () => {
    const endpoint = await viaPosterEndpoint(new FormData(), false);

    expect(endpoint).toEqual({ status: 403, data: { error: 'api_key_read_only' } });
  });
});

describe('the frame editor spending actions answer like their ops', () => {
  const rows = [{ name: 'one', values: {} }];

  it('sound and generate_sound refuse an unknown sound', async () => {
    const action = await viaAction('sound', { sound: 'nope', text: 'hi' });
    const endpoint = await viaEndpoint('generate_sound', { sound: 'nope', text: 'hi' });

    expect(action).toEqual({ status: 400, data: { error: 'invalid_sound' } });
    expect(endpoint).toEqual(action);
  });

  it('sound and generate_sound stop at the credit gate', async () => {
    gated.value = true;

    const action = await viaAction('sound', { sound: 'music', text: 'calm piano' });
    const endpoint = await viaEndpoint('generate_sound', { sound: 'music', text: 'calm piano' });

    expect(action.status).toBe(402);
    expect(action.data.error).toBe('credits_exhausted');
    expect(endpoint).toEqual(action);
  });

  it('renderBatch and render_batch refuse bad settings', async () => {
    const action = await viaAction('renderBatch', { version: '1', settings: '{"fps":"x"}', rows: JSON.stringify(rows) });
    const endpoint = await viaEndpoint('render_batch', { version: 1, settings: { fps: 'x' }, rows });

    expect(action).toEqual({ status: 400, data: { error: 'invalid_settings' } });
    expect(endpoint).toEqual(action);
  });

  it('renderBatch and render_batch refuse rows that are no list', async () => {
    const action = await viaAction('renderBatch', { version: '1', rows: '{}' });
    const endpoint = await viaEndpoint('render_batch', { version: 1, rows: {} });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });

  it('renderBatch and render_batch ask to save first on a stale version', async () => {
    const action = await viaAction('renderBatch', { version: '9', rows: JSON.stringify(rows) });
    const endpoint = await viaEndpoint('render_batch', { version: 9, rows });

    expect(action).toEqual({ status: 409, data: { error: 'save_first' } });
    expect(endpoint).toEqual(action);
  });

  it('renderBatch and render_batch stop at the credit gate', async () => {
    gated.value = true;

    const action = await viaAction('renderBatch', { version: '1', rows: JSON.stringify(rows) });
    const endpoint = await viaEndpoint('render_batch', { version: 1, rows });

    expect(action.status).toBe(402);
    expect(action.data.error).toBe('credits_exhausted');
    expect(endpoint).toEqual(action);
  });
});

describe('the frame editor history, export and library actions answer like their ops', () => {
  it('revisions and list_revisions', async () => {
    const action = await viaAction('revisions', {});
    const endpoint = await viaEndpoint('list_revisions', {});

    expect(action.status).toBe(200);
    expect(action.data.revisions).toHaveLength(1);
    expect(endpoint).toEqual(action);
  });

  it('restore and restore_revision refuse a version that never existed', async () => {
    const action = await viaAction('restore', { version: '9' });
    const endpoint = await viaEndpoint('restore_revision', { version: 9 });

    expect(action).toEqual({ status: 404, data: { error: 'no_such_version' } });
    expect(endpoint).toEqual(action);
  });

  it('still and export_still refuse an unknown image format', async () => {
    const action = await viaAction('still', { format: 'bmp' });
    const endpoint = await viaEndpoint('export_still', { format: 'bmp' });

    expect(action).toEqual({ status: 400, data: { error: 'invalid_image_format' } });
    expect(endpoint).toEqual(action);
  });

  it('render and start_render refuse bad settings', async () => {
    const action = await viaAction('render', { version: '1', settings: '{"fps":"x"}' });
    const endpoint = await viaEndpoint('start_render', { version: 1, settings: { fps: 'x' } });

    expect(action).toEqual({ status: 400, data: { error: 'invalid_settings' } });
    expect(endpoint).toEqual(action);
  });

  it('render and start_render ask to save first on a stale version', async () => {
    const action = await viaAction('render', { version: '9' });
    const endpoint = await viaEndpoint('start_render', { version: 9 });

    expect(action).toEqual({ status: 409, data: { error: 'save_first' } });
    expect(endpoint).toEqual(action);
  });

  it('render and start_render stop at the credit gate', async () => {
    gated.value = true;

    const action = await viaAction('render', { version: '1' });
    const endpoint = await viaEndpoint('start_render', { version: 1 });

    expect(action.status).toBe(402);
    expect(endpoint).toEqual(action);
  });

  it('withdrawGallery and withdraw_gallery on an item that is not listed', async () => {
    const action = await viaAction('withdrawGallery', { id: 'nope' });
    const endpoint = await viaEndpoint('withdraw_gallery', { id: 'nope' });

    expect(action.status).toBe(404);
    expect(endpoint).toEqual(action);
  });

  it('publishGallery and publish_gallery refuse an empty title', async () => {
    const action = await viaAction('publishGallery', { title: '', description: '', tags: '' });
    const endpoint = await viaEndpoint('publish_gallery', { title: '', description: '', tags: '' });

    expect(action.status).toBeGreaterThanOrEqual(400);
    expect(endpoint).toEqual(action);
  });

  it('deleteTemplate and delete_template refuse what is not removable', async () => {
    const action = await viaAction('deleteTemplate', { id: 'nope' });
    const endpoint = await viaEndpoint('delete_template', { id: 'nope' });

    expect(action).toEqual({ status: 400, data: { error: 'not_removable' } });
    expect(endpoint).toEqual(action);
  });

  it('cancelRender and cancel_render with nothing running', async () => {
    const action = await viaAction('cancelRender', {});
    const endpoint = await viaEndpoint('cancel_render', {});

    expect(action.status).toBeGreaterThanOrEqual(400);
    expect(endpoint).toEqual(action);
  });
});

describe('the frame editor save refuses a malformed doc instead of throwing', () => {
  it('save and save_doc answer 400 to tracks that are not a list', async () => {
    const action = await viaAction('save', { version: '1', doc: '{"tracks":3}' });
    const endpoint = await viaEndpoint('save_doc', { version: 1, doc: { tracks: 3 } });

    expect(action.status).toBe(400);
    expect(endpoint).toEqual(action);
  });
});

describe('the frame editor page load and its op answer the same', () => {
  it('load and editor_session', async () => {
    const db = seed();
    const page = await (load as (event: unknown) => Promise<unknown>)({
      params: { projectId: PROJECT, canvasId: CANVAS, nodeId: NODE },
      url: new URL(`https://feega.test/p/${PROJECT}/c/${CANVAS}/motion/${NODE}`),
      locals: { safeGetSession: async () => ({ session: {}, user: { id: USER } }), db: async () => db }
    });
    const endpoint = await viaEndpoint('editor_session', {});

    expect(endpoint).toEqual({ status: 200, data: JSON.parse(JSON.stringify(page)) });
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

describe('upload_slot hands the browser a signed upload the register ops accept', () => {
  it('an export slot lands in the export folder record_export reads', async () => {
    const slot = await viaEndpoint('upload_slot', { purpose: 'export' });
    const recorded = await viaEndpoint('record_export', { path: slot.data.path, width: 1920, height: 1080, seconds: 3 });

    expect(slot.status).toBe(200);
    expect(slot.data.token).toBe('upload-token');
    expect(recorded).toEqual({ status: 400, data: { error: 'file_not_found' } });
  });

  it('a font slot lands under the uploads upload_font reads', async () => {
    const slot = await viaEndpoint('upload_slot', { purpose: 'font', name: 'My Font.woff2' });
    const uploaded = await viaEndpoint('upload_font', { path: slot.data.path });

    expect(slot.data.path).toMatch(/My_Font\.woff2$/);
    expect(uploaded).toEqual({ status: 400, data: { error: 'file_not_found' } });
  });

  it('refuses a purpose it does not know', async () => {
    const slot = await viaEndpoint('upload_slot', { purpose: 'nope' });

    expect(slot.status).toBe(400);
  });

  it('refuses a read-only key', async () => {
    const slot = await viaEndpoint('upload_slot', { purpose: 'export' }, false);

    expect(slot).toEqual({ status: 403, data: { error: 'api_key_read_only' } });
  });
});
