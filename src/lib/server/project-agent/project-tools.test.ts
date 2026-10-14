import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/canvas-catalogue', () => {
  const offer = (ids: string[]) => ({ choices: ids.map((id) => ({ id })), recommended: ids.slice(0, 1).map((id) => ({ tier: 'balanced', id })), synced: true });
  return { canvasModelCatalogue: async () => ({ text: offer(['m1']), image: offer(['img-a', 'img-b']), video: offer([]) }) };
});
import type { Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';
import { SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const NODE = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const RUN = '66666666-6666-6666-6666-666666666666';

const run = (t: Tool, args: unknown) =>
  (t.execute as (a: unknown, o: unknown) => Promise<unknown>)(args, { toolCallId: 't1', messages: [] });

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
  data: { prompt: 'ciao', model: 'm1' },
  version: 3
};

const runRow = {
  id: RUN,
  org_id: ORG,
  node_id: NODE,
  prompt: 'ciao',
  model: 'm1',
  params: {},
  status: 'running',
  error: null,
  output_asset_id: null,
  external_job_id: null,
  cost_usd: null,
  attempts: 0,
  started_at: '2026-09-21T00:00:00Z',
  finished_at: null,
  actor_kind: 'agent',
  actor_id: USER
};

describe('update_node — a patch on the current row, never a replacement', () => {
  it('keeps the keys the agent did not send', async () => {
    const rows = { nodes: [{ ...nodeRow, data: { ...nodeRow.data } }], canvas_events: [{}] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.update_node, { nodeId: NODE, data: { prompt: 'x' } });

    expect(out).toMatchObject({ outcome: 'written' });
    expect(rows.nodes[0]).toMatchObject({ version: 4, data: { prompt: 'x', model: 'm1' } });
  });

  it('a merged row the schema refuses is reported, not written', async () => {
    const rows = { nodes: [{ ...nodeRow, data: { ...nodeRow.data } }] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.update_node, { nodeId: NODE, data: { prompt: 42 } });

    expect(out).toMatchObject({ outcome: 'invalid' });
    expect(rows.nodes[0].version).toBe(3);
  });
});

describe('le scritture firmano agent per conto della persona', () => {
  it('create_node porta actor_kind, actor_id e agent_key', async () => {
    const { db, calls } = fakeDb({ nodes: [nodeRow] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    await run(tools.create_node, { canvasId: CANVAS, type: 'text', x: 1, y: 2, data: { prompt: 'p' } });

    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.table).toBe('nodes');
    expect(insert.payload).toMatchObject({
      org_id: ORG,
      project_id: PROJECT,
      actor_kind: 'agent',
      actor_id: USER,
      agent_key: SIDEBAR_AGENT_KEY
    });
  });

  it('run_node scrive la run come agente, col user id', async () => {
    // findNode trova il nodo; writeNodeData non scrive (updateRows vuoto) → conflict dopo createRun.
    const { db, calls } = fakeDb(
      { nodes: [nodeRow], node_runs: [runRow] },
      { updateRows: { nodes: [] } }
    );
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.run_node, {
      nodeId: NODE,
      medium: 'text',
      prompt: 'ciao',
      model: 'm1',
      expectedVersion: 3
    });

    const insert = calls.find((c) => c.op === 'insert' && c.table === 'node_runs')!;
    expect(insert).toBeDefined();
    expect(insert.payload).toMatchObject({
      org_id: ORG,
      node_id: NODE,
      actor_kind: 'agent',
      actor_id: USER
    });
    expect(out).toMatchObject({ outcome: 'conflict' });
  });

  it('ogni scrittura porta org_id nel payload o nel WHERE', async () => {
    const { db, calls } = fakeDb({ nodes: [nodeRow], nodes_connections: [{}] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    await run(tools.delete_node, { nodeId: NODE });
    await run(tools.move_node, { nodeId: NODE, x: 1, y: 2 });
    await run(tools.connect_nodes, { canvasId: CANVAS, sourceNodeId: NODE, targetNodeId: NODE });

    const writes = calls.filter((c) => c.op === 'insert' || c.op === 'update');
    expect(writes.length).toBeGreaterThan(2);
    for (const call of writes) {
      const payloadHasOrg = JSON.stringify(call.payload ?? {}).includes(ORG);
      const filterHasOrg = call.filters.some(([col, val]) => col === 'org_id' && val === ORG);
      expect(payloadHasOrg || filterHasOrg, `${call.table} ${call.op} senza org_id`).toBe(true);
    }
  });

  it('connect_nodes rifiuta un arco verso un nodo con un modello uncensored', async () => {
    const sourceRow = { ...nodeRow, id: '77777777-7777-7777-7777-777777777777', data: { prompt: 'ciao' } };
    const targetRow = { ...nodeRow, type: 'image', data: { model: 'wiro/uncensored-image' } };
    const { db, calls } = fakeDb(
      { nodes: [sourceRow, targetRow], ai_models: [{ id: 'wiro/uncensored-image', uncensored: true }] },
      { filter: true }
    );
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.connect_nodes, { canvasId: CANVAS, sourceNodeId: sourceRow.id, targetNodeId: NODE });

    expect(out).toMatchObject({ error: 'uncensored_no_inputs' });
    expect(calls.some((c) => c.table === 'nodes_connections' && c.op === 'insert')).toBe(false);
  });
});

describe('run_node rifiuta prima di spendere', () => {
  it('un medium che non esiste non apre nessuna run', async () => {
    const { db, calls } = fakeDb({ node_runs: [runRow], nodes: [nodeRow] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.run_node, { nodeId: NODE, medium: 'gif', expectedVersion: 3 });

    expect(out).toMatchObject({ error: 'bad_medium' });
    expect(calls.some((c) => c.table === 'node_runs')).toBe(false);
  });
});

describe('create_node scrive solo una forma che la tela sa disegnare', () => {
  const setup = () => {
    const rows = { nodes: [] as Array<{ data: unknown }>, canvas_events: [] as unknown[] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    return { rows, tools: createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER }) };
  };

  it('un text con content al posto di prompt è rifiutato, e indica doc', async () => {
    const { rows, tools } = setup();

    const out = (await run(tools.create_node, {
      canvasId: CANVAS,
      type: 'text',
      x: 0,
      y: 0,
      displayName: 'Launch Hooks',
      data: { content: '1. hook\n2. hook\n3. hook' }
    })) as { outcome: string; message: string };

    expect(out.outcome).toBe('invalid');
    expect(out.message).toContain('content');
    expect(out.message).toContain('doc');
    expect(rows.nodes).toHaveLength(0);
  });

  it('un campo che il tipo non ha è rifiutato, non tolto in silenzio', async () => {
    const { rows, tools } = setup();

    const out = (await run(tools.create_node, {
      canvasId: CANVAS,
      type: 'doc',
      x: 0,
      y: 0,
      data: { content: 'ciao', public: false, body: 'x' }
    })) as { outcome: string; message: string };

    expect(out.outcome).toBe('invalid');
    expect(out.message).toContain('body');
    expect(rows.nodes).toHaveLength(0);
  });

  it('un doc con content torna la riga salvata', async () => {
    const { db, calls } = fakeDb({ nodes: [], canvas_events: [] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = (await run(tools.create_node, {
      canvasId: CANVAS,
      type: 'doc',
      x: 0,
      y: 0,
      data: { content: '1. hook', public: false }
    })) as { outcome: string; node: { data: unknown } };

    const insert = calls.find((c) => c.op === 'insert' && c.table === 'nodes')!;
    expect(out.outcome).toBe('written');
    expect(out.node.data).toEqual((insert.payload as { data: unknown }).data);
    expect(out.node.data).toEqual({ content: '1. hook', public: false });
  });
});

describe('update_node rifiuta un campo che il tipo non ha', () => {
  it('content su un text non viene scritto', async () => {
    const rows = { nodes: [{ ...nodeRow, data: { ...nodeRow.data } }], canvas_events: [{}] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.update_node, { nodeId: NODE, data: { content: 'x' } });

    expect(out).toMatchObject({ outcome: 'invalid' });
    expect(rows.nodes[0].version).toBe(3);
  });
});

describe('the chat agent sets a node model only from the canvas catalogue', () => {
  it('create_node accepts an offered model on an image node', async () => {
    const { db } = fakeDb({ nodes: [] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER }) as Record<string, Tool>;

    const out = (await run(tools.create_node, { canvasId: CANVAS, type: 'image', x: 0, y: 0, data: { prompt: 'p', model: 'img-b' } })) as { outcome: string };

    expect(out.outcome).toBe('written');
  });

  it('create_node refuses an unknown model, suggesting the recommended ones', async () => {
    const { db } = fakeDb({ nodes: [] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER }) as Record<string, Tool>;

    const out = (await run(tools.create_node, { canvasId: CANVAS, type: 'image', x: 0, y: 0, data: { prompt: 'p', model: 'nope' } })) as { outcome: string; message: string };

    expect(out.outcome).toBe('invalid');
    expect(out.message).toMatch(/nope.*img-a \(balanced\)/);
  });

  it('update_node refuses an unknown model on a text node', async () => {
    const { db } = fakeDb({ nodes: [{ ...nodeRow }] });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER }) as Record<string, Tool>;

    const out = (await run(tools.update_node, { nodeId: NODE, data: { model: 'nope' } })) as { outcome: string; message: string };

    expect(out.outcome).toBe('invalid');
    expect(out.message).toMatch(/m1 \(balanced\)/);
  });
});

describe('set_composition_component — a canvas composition on a library component, as in the node', () => {
  const STRIP = 'builtin:photo-strip';
  const compositionRow = () => ({
    ...nodeRow,
    type: 'composition',
    data: { layout: 'tilted-grid', layoutParams: {}, camera: { preset: 'static', params: {} }, background: { color: '#000000' }, duration: 6, aspect: '9:16', refId: null } as Record<string, unknown>
  });

  it('list_components names every library component with its fields', async () => {
    const { db } = fakeDb({ motion_templates: [] }, { filter: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = (await run(tools.list_components, {})) as { components: { id: string; fields: { key: string; type: string }[] }[] };
    const strip = out.components.find((c) => c.id === STRIP);

    expect(strip?.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'media', type: 'media_list' })]));
  });

  it('writes the component and its text on the node; wired media fill its media field by themselves', async () => {
    const rows = { nodes: [compositionRow()], canvas_events: [{}], motion_templates: [] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.set_composition_component, { nodeId: NODE, component: STRIP, values: { captions: 'Rome' } });

    expect(out).toMatchObject({ outcome: 'written' });
    expect(rows.nodes[0].data).toMatchObject({ layout: 'tilted-grid', template: { id: STRIP, values: { captions: 'Rome' } } });
  });

  it('refuses an unknown component or field without writing', async () => {
    const rows = { nodes: [compositionRow()], motion_templates: [] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    expect(await run(tools.set_composition_component, { nodeId: NODE, component: 'builtin:nope', values: {} })).toMatchObject({ outcome: 'invalid' });
    expect(await run(tools.set_composition_component, { nodeId: NODE, component: STRIP, values: { nope: 'x' } })).toMatchObject({ outcome: 'invalid' });
    expect(rows.nodes[0].version).toBe(3);
  });

  it('component null puts the node back on its media layout', async () => {
    const row = compositionRow();
    const rows = { nodes: [{ ...row, data: { ...row.data, template: { id: STRIP, values: {} } } }], canvas_events: [{}], motion_templates: [] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    await run(tools.set_composition_component, { nodeId: NODE, component: null });

    expect(rows.nodes[0].data.template).toBeUndefined();
  });

  it('refuses a node that is not a composition', async () => {
    const rows = { nodes: [{ ...nodeRow }], motion_templates: [] };
    const { db } = fakeDb(rows, { filter: true, mutate: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    expect(await run(tools.set_composition_component, { nodeId: NODE, component: STRIP })).toMatchObject({ outcome: 'invalid' });
  });
});

describe('frame elements, the same op the canvas drag uses', () => {
  const A = '77777777-7777-4777-8777-777777777777';
  const B = '88888888-8888-4888-8888-888888888888';
  const GEN = '99999999-9999-4999-8999-999999999999';
  const ASSET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const frame = (id: string) => ({ ...nodeRow, id, type: 'motion', data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, props: { text: 'hi' } }, 'txt');
  const withText = added.ok ? added.doc : newMotionDoc(MotionFormat.Landscape);
  const revision = (nodeId: string, doc: unknown) => ({ org_id: ORG, node_id: nodeId, version: 1, doc, summary: null, actor_kind: 'user' });
  const rows = () => ({
    nodes: [frame(A), frame(B), { ...nodeRow, id: GEN, type: 'image', data: { prompt: 'a cat', refId: ASSET } }],
    projects: [{ id: PROJECT, org_id: ORG, name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '', mode: 'standard' }],
    motion_revisions: [revision(A, withText), revision(B, newMotionDoc(MotionFormat.Square))],
    assets: [{ id: ASSET, org_id: ORG, project_id: PROJECT, type: 'image', url: 'x.png', content: null, mime_type: 'image/png', bytes: 1, width: 64, height: 64, duration_s: null, source: 'generated', source_node_id: GEN, uncensored: false, created_at: '' }],
    nodes_connections: [],
    canvas_events: [{}]
  });
  const revisionsOf = (calls: { table: string; op: string; payload?: unknown }[], nodeId: string) =>
    calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert' && (c.payload as { node_id: string }).node_id === nodeId).map((c) => (c.payload as { doc: { tracks: { clips: { id: string; component: string }[] }[] } }).doc.tracks.flatMap((t) => t.clips));

  it('move_frame_element moves a text element from one frame to another', async () => {
    const { db, calls } = fakeDb(rows(), { filter: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.move_frame_element, { frameId: A, elementId: 'txt', toFrameId: B, x: 0.5, y: 0.5 });

    expect(out).toMatchObject({ outcome: 'done', frame_id: B, element_id: 'txt' });
    expect(revisionsOf(calls, B).map((clips) => clips.map((c) => c.id))).toEqual([['txt']]);
    expect(revisionsOf(calls, A)).toEqual([[]]);
  });

  it('place_in_frame drops a generated picture in a frame and leaves the generative node alone', async () => {
    const { db, calls } = fakeDb(rows(), { filter: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.place_in_frame, { nodeId: GEN, toFrameId: B, x: 0.2, y: 0.2 });

    expect(out).toMatchObject({ outcome: 'done', frame_id: B });
    expect(revisionsOf(calls, B)[0].map((c) => c.component)).toEqual(['Image']);
    expect(calls.some((c) => c.table === 'nodes' && c.op === 'update' && c.filters.some(([k, v]) => k === 'id' && v === GEN))).toBe(false);
  });

  it('connect_nodes from a generated image to a frame places the picture in it', async () => {
    const { db, calls } = fakeDb(rows(), { filter: true });
    const tools = createProjectTools({ db, orgId: ORG, projectId: PROJECT, userId: USER });

    const out = await run(tools.connect_nodes, { canvasId: CANVAS, sourceNodeId: GEN, targetNodeId: B });

    expect(out).toMatchObject({ placed_in_frame: { clip_id: expect.any(String) } });
    expect(revisionsOf(calls, B)[0].map((c) => c.component)).toEqual(['Image']);
  });
});

describe('the chat reaches every canvas op of the API, from the same table', () => {
  const opsOf = (surface: Record<string, Tool>) => (surface.canvas_tool as unknown as { inputSchema: { shape: { op: { options: string[] } } } }).inputSchema.shape.op.options;
  const tools = () => createProjectTools({ db: fakeDb({}).db, orgId: ORG, projectId: PROJECT, userId: USER });

  it('every op the chat can send is a tool or an op of canvas_tool', async () => {
    const { CANVAS_OPS, chatSendsOp } = await import('$lib/server/canvas/canvas-ops');
    const surface = tools();

    const missing = Object.keys(CANVAS_OPS).filter((name) => chatSendsOp(name as never) && !(name in surface) && !opsOf(surface).includes(name));

    expect(missing).toEqual([]);
  });

  it('canvas_tool offers no op that already is a tool of its own', () => {
    const surface = tools();

    expect(opsOf(surface).filter((name) => name in surface)).toEqual([]);
  });

  it('canvas_tool runs an op with its checked input', async () => {
    const surface = tools();

    expect(await run(surface.canvas_tool!, { op: 'rename_canvas', input: { canvasId: CANVAS } })).toMatchObject({ error: 'invalid_input' });
    expect(await run(surface.canvas_tool!, { op: 'list_templates', input: {} })).toHaveProperty('templates');
  });

  it('keeps the ops that need bytes the chat cannot send out of it', () => {
    expect(opsOf(tools())).not.toContain('request_upload');
    expect(opsOf(tools())).not.toContain('clone_voice');
  });
});
