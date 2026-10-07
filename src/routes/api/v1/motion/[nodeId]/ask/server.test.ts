import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

const ORG = 'org-1';
const USER = 'user-1';
const NODE = 'node-1';
const PROJECT = 'project-1';
const CANVAS = 'canvas-1';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 }
};

const offeredTools: string[][] = [];
let step = 0;

function scriptedModel() {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      offeredTools.push((options.tools ?? []).map((t) => t.name));
      step++;
      const parts =
        step === 1
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 'c1', toolName: 'add_clip', input: JSON.stringify({ component: 'Title', start: 0, duration: 2, props: { text: 'Hi', color: '#ff0000' } }) },
              { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Added a red title.' },
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

const store = vi.hoisted(() => ({
  runs: new Map<string, Record<string, unknown>>(),
  turns: [] as { role: string; content?: string; actor?: unknown }[],
  revisions: [] as { expectedVersion: number; actor: unknown; summary?: string | null }[],
  node: null as null | Record<string, unknown>,
  caller: null as null | Record<string, unknown>,
  gate: null as null | Response
}));

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: () => scriptedModel(),
  llmCodeModel: () => 'code/model',
  llmVisionModel: () => 'vision/model'
}));
vi.mock('$lib/server/openrouter-models', () => ({ ensureGatewayModels: async () => undefined, gatewayRate: () => ({ input: 1, cachedInput: 0, output: 1 }), gatewayModel: () => null }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => [{ id: 'anthropic/claude-sonnet-5.5', label: 'S', provider: 'anthropic', costTier: '$$$', inputUsdPerM: 2, outputUsdPerM: 10, efforts: ['medium'], defaultEffort: 'medium' }]
}));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({ inputTokens: 10, outputTokens: 5 }), logAiCall: vi.fn(), withOrgContext: (_id: string, fn: () => unknown) => fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => (store.caller ? { caller: store.caller } : { error: { status: 401, body: { error: 'unauthenticated' } } }) }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => store.gate ?? undefined }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) => (input.orgId === ORG && input.nodeId === NODE ? store.node : null),
  patchNodeData: async () => ({ outcome: 'written' })
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async (_db: unknown, input: { orgId: string }) => (input.orgId === ORG ? { id: PROJECT, brandId: null } : null) }));
vi.mock('$lib/server/repos/assets', () => ({ listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({}), signAssetPaths: async () => new Map() }));
vi.mock('$lib/server/repos/chat', () => ({
  openNodeThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  saveTurn: async (_db: unknown, turn: { role: string; content?: string; actor?: unknown }) => {
    store.turns.push(turn);
  }
}));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => {
  const real = await importOriginal<typeof import('$lib/server/repos/motion-revisions')>();
  return {
    ...real,
    readHead: async () => null,
    appendRevision: async (_db: unknown, input: { expectedVersion: number; doc: unknown; actor: unknown; summary?: string | null }) => {
      store.revisions.push(input);
      return { outcome: real.RevisionOutcome.Written, head: { version: input.expectedVersion + 1, doc: input.doc, summary: input.summary ?? null, actorKind: 'agent' } };
    }
  };
});
vi.mock('$lib/server/repos/node-runs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/node-runs')>()),
  createRun: async (_db: unknown, input: Record<string, unknown>) => {
    const run = { id: `run-${store.runs.size + 1}`, orgId: input.orgId, nodeId: input.nodeId, prompt: input.prompt, model: input.model, params: input.params, status: 'running', error: null, costUsd: null, actorKind: input.actorKind, actorId: input.actorId, startedAt: new Date().toISOString(), finishedAt: null };
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

const { POST } = await import('./+server');
const { GET: RUN } = await import('../../runs/[runId]/+server');

function ask(nodeId: string, body: unknown) {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}/ask`);
  const request = new Request(url, { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return POST({ request, params: { nodeId }, url } as unknown as Parameters<typeof POST>[0]);
}

function runStatus(runId: string) {
  const url = new URL(`https://feega.test/api/v1/motion/runs/${runId}`);
  const request = new Request(url, { headers: { authorization: 'Bearer t' } });
  return RUN({ request, params: { runId }, url } as unknown as Parameters<typeof RUN>[0]);
}

async function settled(runId: string) {
  for (let i = 0; i < 100; i++) {
    const body = await (await runStatus(runId)).json();
    if (body.status !== 'running') {
      return body;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('the run never settled');
}

beforeEach(() => {
  store.runs.clear();
  store.turns.length = 0;
  store.revisions.length = 0;
  offeredTools.length = 0;
  step = 0;
  store.gate = null;
  store.caller = { db: { storage: { from: () => ({}) } }, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' };
  store.node = { id: NODE, canvasId: CANVAS, projectId: PROJECT, type: 'motion', displayName: 'Trailer', position: { x: 0, y: 0, z: 0 }, size: { width: null, height: null }, data: {}, version: 1 };
});

describe('POST /api/v1/motion/[nodeId]/ask', () => {
  it('runs the editor agent and reports the revision it wrote', async () => {
    const res = await ask(NODE, { prompt: 'make the title red' });
    expect(res.status).toBe(202);
    const { run_id } = await res.json();

    const run = await settled(run_id);

    expect(run).toMatchObject({ run_id, node_id: NODE, status: 'done', reply: 'Added a red title.', version: 1, summary: 'added Title' });
    expect(run.cost_usd).toBeGreaterThan(0);
    expect(run.editor_url).toBe(`/p/${PROJECT}/c/${CANVAS}/motion/${NODE}`);
    expect(store.revisions).toHaveLength(1);
    expect(store.revisions[0].actor).toEqual({ kind: 'agent', id: USER, agentKey: 'motion' });
  });

  it('writes the request into the editor thread as the agent acting for the user', async () => {
    const { run_id } = await (await ask(NODE, { prompt: 'make the title red' })).json();
    await settled(run_id);

    expect(store.turns[0]).toMatchObject({ role: 'user', content: 'make the title red', actor: { kind: 'agent', id: USER, agentKey: 'mcp' } });
    expect(store.turns.at(-1)).toMatchObject({ role: 'assistant', content: 'Added a red title.' });
    expect(store.runs.get(run_id)).toMatchObject({ actorKind: 'agent', actorId: USER });
  });

  it('does not offer frame viewing with no editor open to draw them', async () => {
    const { run_id } = await (await ask(NODE, { prompt: 'make the title red' })).json();
    await settled(run_id);

    expect(offeredTools[0]).toContain('add_clip');
    expect(offeredTools[0]).not.toContain('view_frames');
  });

  it('refuses a node that is not a motion video', async () => {
    store.node = { ...store.node, type: 'image' };
    const res = await ask(NODE, { prompt: 'x' });
    expect(res.status).toBe(404);
    expect(store.runs.size).toBe(0);
  });

  it('refuses a node of another org', async () => {
    store.caller = { ...store.caller, orgId: 'org-2' };
    const res = await ask(NODE, { prompt: 'x' });
    expect(res.status).toBe(404);
  });

  it('refuses a read-only key before spending', async () => {
    store.caller = { ...store.caller, writeAllowed: false };
    const res = await ask(NODE, { prompt: 'x' });
    expect(res.status).toBe(403);
    expect(store.turns).toHaveLength(0);
  });

  it('stops at the credit gate', async () => {
    store.gate = new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402 });
    const res = await ask(NODE, { prompt: 'x' });
    expect(res.status).toBe(402);
    expect(store.turns).toHaveLength(0);
  });

  it('refuses an empty prompt', async () => {
    const res = await ask(NODE, { prompt: '  ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/motion/runs/[runId]', () => {
  it('hides a run of another org', async () => {
    const { run_id } = await (await ask(NODE, { prompt: 'make the title red' })).json();
    await settled(run_id);
    store.caller = { ...store.caller, orgId: 'org-2' };

    expect((await runStatus(run_id)).status).toBe(404);
  });
});
