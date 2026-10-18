import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const NODE = 'node-1';
const BLOCKED_WORD = 'zqxforbidden';

const state = vi.hoisted(() => ({ writeAllowed: true, db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [], insertOrgTemplate: vi.fn(), deleteOrgTemplate: vi.fn() }));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/canvas/sign-media')>()), signAssetPaths: async () => new Map(), createAssetSigningDb: () => ({}) }));
vi.mock('$lib/server/repos/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/projects')>()),
  findProjectById: async () => ({ id: 'p-1', brandId: null, mode: 'standard' })
}));
vi.mock('$lib/server/moderation/model-input', () => ({
  screenModelInput: async (_db: unknown, input: { texts: string[] }) => (input.texts.some((t) => t.includes(BLOCKED_WORD)) ? { ok: false, error: 'blocked' } : { ok: true })
}));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: 'motion', displayName: 'Poster', data: { format: '4:5' }, version: 1 } : null
}));

const { POST } = await import('./+server');
const { GET } = await import('../../tools/+server');

const post = (nodeId: string, body: unknown) => {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}/tools`);
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }), params: { nodeId }, url } as never);
};

const head = async () => (await readHead(state.db as never, { orgId: ORG, nodeId: NODE }))?.doc as MotionDoc;

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  state.writeAllowed = true;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Portrait), actor: { kind: 'user', id: 'u-1' }, summary: 'start' });
});

describe('POST /api/v1/motion/:node/tools runs one motion tool of the chat agent', () => {
  it('a doc edit is saved as a new revision by the agent', async () => {
    const res = await post(NODE, { tool: 'add_clip', input: { component: 'Title', start: 0, duration: 2, props: { text: 'From an outside agent' } } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ tool: 'add_clip', version: 2, output: { ok: true } });
    expect(JSON.stringify((await head()).tracks)).toContain('From an outside agent');
  });

  it('set_canvas makes the doc a still poster', async () => {
    await post(NODE, { tool: 'set_canvas', input: { format: MotionFormat.Poster, still: 1 } });

    expect(await head()).toMatchObject({ width: 1080, height: 1527, still: { frame: 30 } });
  });

  it('a read tool answers and saves nothing', async () => {
    const res = await post(NODE, { tool: 'get_motion_doc', input: {} });
    const body = await res.json();

    expect(body).toMatchObject({ version: 1, saved: false, output: { width: 1080, height: 1350 } });
  });

  it('input the tool schema refuses never reaches the tool', async () => {
    const res = await post(NODE, { tool: 'set_canvas', input: { still: 'soon' } });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_input');
  });

  it('an unknown tool is a 404 that names where the list is', async () => {
    const res = await post(NODE, { tool: 'make_it_pop', input: {} });

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('unknown_tool');
  });

  it('a stale version is a conflict, never a silent overwrite', async () => {
    const res = await post(NODE, { tool: 'add_clip', version: 7, input: { component: 'Title', start: 0, duration: 1 } });

    expect(res.status).toBe(409);
    expect((await head()).tracks.flatMap((t) => t.clips)).toEqual([]);
  });

  it('text the safety review blocks is refused like in the chat', async () => {
    const res = await post(NODE, { tool: 'add_clip', input: { component: 'Title', start: 0, duration: 1, props: { text: BLOCKED_WORD } } });

    expect(res.status).toBe(422);
    expect((await head()).tracks.flatMap((t) => t.clips)).toEqual([]);
  });

  it('a read-only key cannot run a tool', async () => {
    state.writeAllowed = false;

    expect((await post(NODE, { tool: 'get_motion_doc', input: {} })).status).toBe(403);
  });

  it('a node of another org is not found', async () => {
    expect((await post('elsewhere', { tool: 'get_motion_doc', input: {} })).status).toBe(404);
  });
});

const shape = async (props: Record<string, unknown>) => (await (await post(NODE, { tool: 'add_clip', input: { component: 'Shape', start: 0, duration: 2, props: { shape: 'rect', ...props } } })).json()).output.clip_id as string;
const tool = async (name: string, input: unknown) => (await (await post(NODE, { tool: name, input })).json()).output;
const stack = async () => (await head()).tracks.flatMap((t) => [...t.clips].reverse().map((c) => c.id));
const clipOf = async (id: string) => (await head()).tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;

describe('layout and layer tools through the endpoint', () => {
  it('add_auto_layout paints its container fill right under the children, over the background', async () => {
    const bg = await shape({ x: 540, y: 675, width: 1080, height: 1350 });
    const a = await shape({ x: 300, y: 675, width: 100, height: 100 });
    const b = await shape({ x: 600, y: 675, width: 100, height: 100 });

    const out = await tool('add_auto_layout', { clip_ids: [a, b], fill: '#ff0000', stroke: '#00ff00', stroke_width: 4, radius: 0.2 });

    expect(out.ok).toBe(true);
    expect(await stack()).toEqual([b, a, out.container_id, bg]);
    expect((await clipOf(out.container_id)).props).toMatchObject({ fill: '#ff0000', stroke: '#00ff00', strokeKind: 'solid', roundness: 0.2 });
  });
});

describe('GET /api/v1/motion/tools lists them', () => {
  const get = (query = '') => {
    const url = new URL(`https://feega.test/api/v1/motion/tools${query}`);
    return GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never);
  };

  it('every tool by name with the first line of what it does', async () => {
    const body = await (await get()).json();

    expect(body.tools.length).toBeGreaterThan(100);
    expect(body.tools).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'set_canvas' }), expect.objectContaining({ name: 'export_image' })]));
  });

  it('one tool with its full description and JSON input schema', async () => {
    const body = await (await get('?name=set_canvas')).json();

    expect(body.tool.input_schema.properties).toHaveProperty('still');
  });
});
