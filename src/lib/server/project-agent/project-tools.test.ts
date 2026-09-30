import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/canvas-catalogue', () => {
  const offer = (ids: string[]) => ({ choices: ids.map((id) => ({ id })), recommended: ids.slice(0, 1).map((id) => ({ tier: 'balanced', id })), synced: true });
  return { canvasModelCatalogue: async () => ({ text: offer(['m1']), image: offer(['img-a', 'img-b']), video: offer([]) }) };
});
import type { Tool } from 'ai';
import { fakeDb } from '$lib/server/db/fake-db';
import { createProjectTools } from './project-tools';
import { SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';

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
