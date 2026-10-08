import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import type { Tool } from 'ai';

const ORG = 'org-1';
const USER = 'user-1';
const NODE = 'node-1';
const IMAGE = 'image-1';
const PROJECT = 'project-1';
const CANVAS = 'canvas-1';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 }
};

let step = 0;
const prompts: string[] = [];

function scriptedModel() {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      step++;
      const parts =
        step % 2 === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: `c${step}`, toolName: 'add_clip', input: JSON.stringify({ component: 'Title', start: 0, duration: 6, props: { text: 'Hello' } }) },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Added a hello title.' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            parts.forEach((p) => controller.enqueue(p as never));
            controller.close();
          }
        })
      };
    }
  });
}

type Row = { id: string; canvasId: string; projectId: string; type: string; displayName: string | null; position: { x: number; y: number; z: number }; size: { width: number | null; height: number | null }; data: Record<string, unknown>; version: number };

const store = vi.hoisted(() => ({
  nodes: [] as Row[],
  runs: new Map<string, Record<string, unknown>>(),
  turns: [] as { role: string; content?: string; actor?: unknown }[],
  revisions: [] as { expectedVersion: number }[],
  blocked: false,
  head: 0
}));

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: () => scriptedModel(),
  llmCodeModel: () => 'code/model',
  llmVisionModel: () => 'vision/model'
}));
vi.mock('$lib/server/openrouter-models', () => ({ ensureGatewayModels: async () => undefined, gatewayRate: () => ({ input: 1, cachedInput: 0, output: 1 }), gatewayModel: () => null }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => [{ id: 'anthropic/claude-opus-5.5', label: 'S', provider: 'anthropic', costTier: '$$$', inputUsdPerM: 2, outputUsdPerM: 10, efforts: ['low'], defaultEffort: 'low' }, { id: 'cheap/model', label: 'C', provider: 'cheap', costTier: '$', inputUsdPerM: 0.1, outputUsdPerM: 0.4, efforts: [], defaultEffort: null }]
}));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({ inputTokens: 10, outputTokens: 5 }), logAiCall: vi.fn(), withOrgContext: (_id: string, fn: () => unknown) => fn(), withBrandContext: (_id: string, fn: () => unknown) => fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => (store.blocked ? { ok: false, error: 'prompt_refused' } : { ok: true }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) => (input.orgId === ORG ? (store.nodes.find((n) => n.id === input.nodeId) ?? null) : null),
  listNodes: async (_db: unknown, input: { canvasId: string }) => store.nodes.filter((n) => n.canvasId === input.canvasId),
  listCanvases: async () => [{ id: CANVAS, name: 'Ideas' }],
  createCanvas: async () => ({ id: 'canvas-new' }),
  listMotionNodes: async () => store.nodes.filter((n) => n.type === 'motion'),
  createNode: async (_db: unknown, input: { canvasId: string; projectId: string; type: string; x: number; y: number; displayName: string | null; data: Record<string, unknown> }) => {
    const row = { id: `motion-${store.nodes.length + 1}`, canvasId: input.canvasId, projectId: input.projectId, type: input.type, displayName: input.displayName, position: { x: input.x, y: input.y, z: 0 }, size: { width: null, height: null }, data: input.data, version: 1 };
    store.nodes.push(row);
    return row;
  },
  patchNodeData: async () => ({ outcome: 'written' })
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async (_db: unknown, input: { orgId: string }) => (input.orgId === ORG ? { id: PROJECT, brandId: null, mode: 'standard' } : null) }));
vi.mock('$lib/server/repos/assets', () => ({
  listProjectAssets: async () => [{ id: 'asset-1', projectId: PROJECT, type: 'image', url: 'org/p/a.png', content: null, mimeType: 'image/png', bytes: 1, width: 1, height: 1, durationS: null, source: 'generated', sourceNodeId: IMAGE, uncensored: false, createdAt: '2026-10-08T00:00:00Z' }],
  findAssets: async () => new Map()
}));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({}), signAssetPaths: async () => new Map() }));
vi.mock('$lib/server/repos/chat', () => ({
  openNodeThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  saveTurn: async (_db: unknown, turn: { role: string; content?: string; actor?: unknown }) => {
    store.turns.push(turn);
  }
}));
vi.mock('$lib/server/repos/chat-reply', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat-reply')>()),
  openReply: async () => ({ progress: async () => undefined, finish: async () => undefined })
}));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => {
  const real = await importOriginal<typeof import('$lib/server/repos/motion-revisions')>();
  return {
    ...real,
    readHead: async () => {
      if (!store.head) {
        return null;
      }
      const { newMotionDoc, MotionFormat } = await import('$lib/motion/doc');
      return { version: store.head, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' };
    },
    appendRevision: async (_db: unknown, input: { expectedVersion: number; doc: unknown; summary?: string | null }) => {
      store.revisions.push(input);
      return { outcome: real.RevisionOutcome.Written, head: { version: input.expectedVersion + 1, doc: input.doc, summary: input.summary ?? null, actorKind: 'agent' } };
    }
  };
});
vi.mock('$lib/server/repos/node-runs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/node-runs')>()),
  createRun: async (_db: unknown, input: Record<string, unknown>) => {
    const run = { id: `run-${store.runs.size + 1}`, orgId: input.orgId, nodeId: input.nodeId, prompt: input.prompt, model: input.model, params: input.params, status: 'running', error: null, costUsd: null, startedAt: new Date().toISOString(), finishedAt: null };
    store.runs.set(run.id, run);
    return run;
  },
  runsByIds: async (_db: unknown, input: { ids: string[] }) => input.ids.map((id) => store.runs.get(id)).filter(Boolean),
  settleRun: async (_db: unknown, input: { runId: string; params: Record<string, unknown>; costUsd: number }) => {
    Object.assign(store.runs.get(input.runId)!, { status: 'done', params: input.params, costUsd: input.costUsd, finishedAt: new Date().toISOString() });
  },
  failRun: async (_db: unknown, input: { runId: string; error: string }) => {
    Object.assign(store.runs.get(input.runId)!, { status: 'failed', error: input.error });
  }
}));

vi.mock('$lib/server/motion/frame-stats', () => ({ frameStats: async (frames: { time: number }[]) => frames.map((f) => ({ time: f.time, luma: 100, lumaStd: 30, whiteShare: 0 })) }));
vi.mock('$lib/server/motion/chromium-frames', () => ({
  serverFramesOpen: () => true,
  chromiumFrames: { open: async () => ({ load: async () => {}, seek: async () => {}, jpeg: async () => Buffer.from([0xff, 0xd8, 0xff]), close: async () => {} }) }
}));

const { createMotionDelegation, MOTION_DELEGATION_TOOLS } = await import('./motion-delegation');

const db = { storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) } };
const tools = () => createMotionDelegation({ db: db as never, orgId: ORG, projectId: PROJECT, userId: USER, origin: 'https://feega.test', pollMs: 5 });
const call = (t: Tool, args: unknown) => (t.execute as (a: unknown, o: unknown) => Promise<Record<string, unknown>>)(args, { toolCallId: 't1', messages: [] });

const motionRow = (over: Partial<Row> = {}): Row => ({ id: NODE, canvasId: CANVAS, projectId: PROJECT, type: 'motion', displayName: 'Trailer', position: { x: 0, y: 0, z: 0 }, size: { width: 288, height: 556 }, data: {}, version: 1, ...over });

beforeEach(() => {
  store.nodes = [motionRow(), { ...motionRow({ id: IMAGE, type: 'image', position: { x: 1000, y: 400, z: 0 }, size: { width: 300, height: 300 } }) }];
  store.runs.clear();
  store.turns.length = 0;
  store.revisions.length = 0;
  store.blocked = false;
  store.head = 0;
  prompts.length = 0;
  step = 0;
});

describe('the canvas agent delegates motion videos', () => {
  it('offers the delegation tools, not the editor tools', () => {
    expect(Object.keys(tools()).sort()).toEqual([...MOTION_DELEGATION_TOOLS].sort());
    expect(Object.keys(tools())).not.toContain('add_clip');
  });

  it('lists the motion videos of this project', async () => {
    const out = await call(tools().list_motion_videos, {});
    expect(out.videos).toEqual([expect.objectContaining({ node_id: NODE, editor_url: `/p/${PROJECT}/c/${CANVAS}/motion/${NODE}` })]);
  });

  it('asks the motion agent and reads its summary back once the run is done', async () => {
    const asked = await call(tools().ask_motion_agent, { nodeId: NODE, request: 'make a 6 s title saying hello' });
    expect(asked).toMatchObject({ status: 'running', editor_url: `/p/${PROJECT}/c/${CANVAS}/motion/${NODE}` });

    const run = await call(tools().get_motion_run, { runId: asked.run_id, waitSeconds: 5 });

    expect(run).toMatchObject({ status: 'done', reply: expect.stringContaining('Added a hello title.'), summary: expect.stringContaining('added Title') });
    expect(store.revisions.length).toBeGreaterThan(0);
    expect(store.turns[0]).toMatchObject({ role: 'user', actor: { kind: 'agent', id: USER, agentKey: 'sidebar' } });
  });

  it('runs the motion agent on the model the canvas chat uses', async () => {
    const delegation = createMotionDelegation({ db: db as never, orgId: ORG, projectId: PROJECT, userId: USER, origin: 'https://feega.test', model: 'cheap/model', pollMs: 5 });

    const asked = await call(delegation.ask_motion_agent, { nodeId: NODE, request: 'x' });

    expect(store.runs.get(asked.run_id as string)).toMatchObject({ model: 'cheap/model' });
  });

  it('hands canvas media to the motion agent as asset ids it can place', async () => {
    const asked = await call(tools().ask_motion_agent, { nodeId: NODE, request: 'use this picture', media: [IMAGE] });
    await call(tools().get_motion_run, { runId: asked.run_id, waitSeconds: 5 });

    expect(store.turns[0].content).toContain('asset-1');
  });

  it('reports a run still working when the wait runs out', async () => {
    store.runs.set('run-slow', { id: 'run-slow', orgId: ORG, nodeId: NODE, prompt: 'x', params: { kind: 'motion-ask' }, status: 'running', error: null, costUsd: null, startedAt: '', finishedAt: null });

    const run = await call(tools().get_motion_run, { runId: 'run-slow', waitSeconds: 0 });

    expect(run).toMatchObject({ status: 'running' });
  });

  it('creates a motion node beside the nodes it is about and starts it with a brief', async () => {
    const out = await call(tools().create_motion_video, { name: 'Hello', canvasId: CANVAS, format: 'landscape', near: [IMAGE], brief: 'a 6 s title saying hello' });

    const created = store.nodes.find((n) => n.id === out.node_id)!;
    expect(created).toMatchObject({ type: 'motion', canvasId: CANVAS, displayName: 'Hello', data: expect.objectContaining({ format: 'landscape' }) });
    expect(created.position.x).toBeGreaterThan(1300);
    expect(created.position.y).toBe(400);
    expect(out.run_id).toBeTruthy();
    expect((await call(tools().get_motion_run, { runId: out.run_id, waitSeconds: 5 })).status).toBe('done');
  });

  it('passes the moderation refusal back instead of spending', async () => {
    store.blocked = true;

    const out = await call(tools().ask_motion_agent, { nodeId: NODE, request: 'something refused' });

    expect(out).toMatchObject({ error: 'prompt_refused' });
    expect(store.runs.size).toBe(0);
  });

  it('refuses a motion node of another project', async () => {
    store.nodes = [motionRow({ projectId: 'project-2' })];

    const out = await call(tools().ask_motion_agent, { nodeId: NODE, request: 'x' });

    expect(out).toMatchObject({ error: 'motion_node_not_found' });
    expect(store.runs.size).toBe(0);
  });

  it('refuses to render a video nobody has written yet', async () => {
    const out = await call(tools().render_motion_video, { nodeId: NODE });
    expect(out).toMatchObject({ error: 'nothing_to_render' });
  });

  it('shows the motion agent frames of the saved video as images', async () => {
    store.head = 2;
    const view = tools().view_motion_frames;

    const out = await call(view, { nodeId: NODE, times: [0, 1] });
    const model = await (view.toModelOutput as (o: unknown) => Promise<{ type: string; value: { type: string; mediaType?: string }[] }>)({ toolCallId: 't1', input: {}, output: out });

    expect(out).toMatchObject({ revision: 2 });
    expect(model.type).toBe('content');
    expect(model.value.filter((p) => p.type === 'file').map((p) => p.mediaType)).toEqual(['image/jpeg', 'image/jpeg']);
  });

  it('refuses frames of a video in another project', async () => {
    store.head = 2;
    store.nodes = [motionRow({ projectId: 'project-2' })];

    expect(await call(tools().view_motion_frames, { nodeId: NODE, times: [0] })).toMatchObject({ error: 'motion_node_not_found' });
  });
});
