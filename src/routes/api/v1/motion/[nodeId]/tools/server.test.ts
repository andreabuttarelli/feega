import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const NODE = 'node-1';
const BLOCKED_WORD = 'zqxforbidden';

const state = vi.hoisted(() => ({ writeAllowed: true, db: null as unknown, screened: [] as string[][], rows: [] as Record<string, unknown>[], assetsAsked: () => {}, nodeAfter: Promise.resolve() as Promise<unknown>, projectAfter: Promise.resolve() as Promise<unknown> }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [], insertOrgTemplate: vi.fn(), deleteOrgTemplate: vi.fn() }));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), listFontAssets: async () => [], listProjectAssets: async () => (state.assetsAsked(), []) }));
vi.mock('$lib/server/canvas/sign-media', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/canvas/sign-media')>()), signAssetPaths: async () => new Map(), createAssetSigningDb: () => ({}) }));
vi.mock('$lib/server/repos/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/projects')>()),
  findProjectById: async () => (await state.projectAfter, { id: 'p-1', brandId: null, mode: 'standard' })
}));
vi.mock('$lib/server/moderation/model-input', () => ({
  screenModelInput: async (_db: unknown, input: { texts: string[] }) => (state.screened.push(input.texts), input.texts.some((t) => t.includes(BLOCKED_WORD)) ? { ok: false, error: 'blocked' } : { ok: true })
}));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    (await state.nodeAfter, input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: 'motion', displayName: 'Poster', data: { format: '4:5' }, version: 1 } : null)
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
  state.rows = fake.rows;
  state.writeAllowed = true;
  state.screened = [];
  state.nodeAfter = Promise.resolve();
  state.projectAfter = Promise.resolve();
  state.assetsAsked = () => {};
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

  it('reads the head while it looks up the node, not after', async () => {
    const db = state.db as { from: (table: string) => unknown };
    const from = db.from.bind(db);
    state.nodeAfter = new Promise((asked) => (db.from = (table: string) => (table === 'motion_revisions' && asked(table), from(table))));

    expect((await post(NODE, { tool: 'get_motion_doc', input: {} })).status).toBe(200);
  });

  it('lists the assets while it looks up the project, not after', async () => {
    state.projectAfter = new Promise((asked) => (state.assetsAsked = () => asked(null)));

    expect((await post(NODE, { tool: 'get_motion_doc', input: {} })).status).toBe(200);
  });

  it('the node patch reuses the node the run already read', async () => {
    const { patchNodeData } = await import('$lib/server/repos/canvas');
    await post(NODE, { tool: 'set_work_area', input: { start: 0, end: 1 } });

    expect(patchNodeData).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ known: expect.objectContaining({ id: NODE, version: 1 }) }));
  });

  it('a stream of ops by the agent folds into one checkpoint, the version still moves', async () => {
    await post(NODE, { tool: 'set_work_area', input: { start: 0, end: 1 } });
    await post(NODE, { tool: 'set_work_area', input: { start: 0, end: 2 } });
    const third = await (await post(NODE, { tool: 'set_work_area', input: { start: 0, end: 1 } })).json();

    expect(third.version).toBe(4);
    expect(state.rows.map((r) => [r.version, r.actor_kind])).toEqual([[1, 'user'], [4, 'agent']]);
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

  it('only the text an op carries goes to the safety review, never its numbers or ids', async () => {
    await post(NODE, { tool: 'set_work_area', input: { start: 0, end: 1 } });
    await post(NODE, { tool: 'add_clip', input: { component: 'Title', start: 0, duration: 1, props: { text: 'Hello there' } } });

    expect(state.screened.map((texts) => texts.join(' '))).toEqual(['', 'Title Hello there']);
  });

  it('a batch goes to the safety review once, with the text of every op', async () => {
    const title = (text: string) => ({ tool: 'add_clip', input: { component: 'Title', start: 0, duration: 1, props: { text } } });
    await post(NODE, { tool: 'batch', input: { ops: [title('one'), { tool: 'set_work_area', input: { start: 0, end: 1 } }, title('two')] } });

    expect(state.screened).toEqual([['Title', 'one', 'Title', 'two']]);
  });

  it('a batch with blocked text saves nothing', async () => {
    const res = await post(NODE, { tool: 'batch', input: { ops: [{ tool: 'add_clip', input: { component: 'Title', start: 0, duration: 1, props: { text: BLOCKED_WORD } } }] } });

    expect(res.status).toBe(422);
    expect((await head()).tracks.flatMap((t) => t.clips)).toEqual([]);
  });

  it('a tool that refuses is a 422 with the reason, not a 200', async () => {
    const res = await post(NODE, { tool: 'set_props', input: { clip_id: 'nope', props: {} } });
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).toMatchObject({ error: 'tool_refused' });
    expect(typeof body.detail).toBe('string');
  });

  it('a batch applies every op in one revision', async () => {
    const title = (text: string) => ({ tool: 'add_clip', input: { component: 'Title', start: 0, duration: 1, props: { text } } });
    const res = await post(NODE, { tool: 'batch', input: { ops: [title('one'), title('two'), title('three')] } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ version: 2, saved: true });
    expect(body.output.results).toHaveLength(3);
    expect(JSON.stringify((await head()).tracks)).toContain('three');
  });

  it('a batch with one refused op saves nothing', async () => {
    const ops = [{ tool: 'add_clip', input: { component: 'Title', start: 0, duration: 1 } }, { tool: 'set_props', input: { clip_id: 'nope', props: {} } }];
    const res = await post(NODE, { tool: 'batch', input: { ops } });
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).toMatchObject({ error: 'tool_refused', index: 1 });
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

describe('auto layout sizing through the endpoint', () => {
  it('set_layout_item fill on a clip not yet parented is kept', async () => {
    const a = await shape({ x: 300, y: 675, width: 100, height: 100 });

    expect((await tool('set_layout_item', { clip_id: a, width: 'fill' })).ok).toBe(true);
  });

  it('add_auto_layout takes the children with their sizing in one call', async () => {
    const a = await shape({ x: 300, y: 675, width: 100, height: 100 });
    const b = await shape({ x: 600, y: 675, width: 100, height: 100 });

    const out = await tool('add_auto_layout', { children: [{ clip_id: a, width: 'fill' }, { clip_id: b, height: 'hug' }] });

    expect(out.ok).toBe(true);
    expect((await clipOf(a)).layoutItem).toMatchObject({ width: 'fill' });
    expect((await clipOf(b)).layoutItem).toMatchObject({ height: 'hug' });
    expect((await clipOf(out.container_id)).autoLayout).toMatchObject({ align: 'start' });
  });
});

const clips = async () => (await head()).tracks.flatMap((t) => t.clips);
const three = async () => [await shape({ x: 300, y: 675, width: 300, height: 300 }), await shape({ x: 400, y: 675, width: 300, height: 300 }), await shape({ x: 500, y: 675, width: 300, height: 300 })];

describe('layer tools through the endpoint', () => {
  it('arrange_layers moves one clip of a shared track in the stack', async () => {
    const [a, b, c] = await three();

    expect((await tool('arrange_layers', { clip_ids: [a], to: 'front' })).ok).toBe(true);
    expect(await stack()).toEqual([a, c, b]);
    expect((await tool('arrange_layers', { clip_ids: [a], to: 'back' })).ok).toBe(true);
    expect((await stack()).at(-1)).toBe(a);
    expect((await tool('arrange_layers', { clip_ids: [a], to: 'forward' })).ok).toBe(true);
    expect(await stack()).toEqual([c, a, b]);
  });

  it('use_as_mask makes the lowest clip mask the others, then release_mask undoes it', async () => {
    const [mask, a, b] = await three();

    const out = await tool('use_as_mask', { clip_ids: [mask, a, b] });

    expect(out.ok).toBe(true);
    expect(JSON.stringify(await head())).toContain(mask);
    expect((await tool('release_mask', { mask_id: mask })).ok).toBe(true);
  });

  it('combine_shapes leaves the bottom shape as the result', async () => {
    const [a, b] = await three();

    expect((await tool('combine_shapes', { clip_ids: [a, b], op: 'union' })).ok).toBe(true);
    expect((await clips()).map((c) => c.id)).not.toContain(b);
  });

  it('precompose groups clips into one and ungroup puts them back', async () => {
    const [a, b] = await three();

    const out = await tool('precompose', { clip_ids: [a, b] });

    expect(out.ok).toBe(true);
    expect((await clips()).map((c) => c.id)).not.toContain(a);
    expect((await tool('ungroup', { clip_id: out.clip_id })).ok).toBe(true);
    expect((await clips()).map((c) => c.id)).toEqual(expect.arrayContaining([a, b]));
  });

  it('parent_clips groups clips under a new null', async () => {
    const [a, b] = await three();

    const out = await tool('parent_clips', { clip_ids: [a, b] });

    expect(out.ok).toBe(true);
    expect((await clips()).filter((c) => c.parent === out.null_id).map((c) => c.id).sort()).toEqual([a, b].sort());
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
