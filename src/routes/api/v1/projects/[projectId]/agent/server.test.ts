import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { tool } from 'ai';
import { z } from 'zod';
import { fakeDb, type Call } from '$lib/server/db/fake-db';
import { forgetReplySchema } from '$lib/server/repos/chat-reply';

import { AGENT_TURN_CAP_USD } from '$lib/server/project-agent/limits';
const streamed = vi.fn();
const { screenModelInput } = vi.hoisted(() => ({ screenModelInput: vi.fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));

const saveTurn = vi.fn(async (_db: unknown, _turn: { role: string; content?: string }) => undefined);

let releaseTail: () => void = () => {};
const world = { stepped: false, fails: false, usdPerToken: 0, db: fakeDb({ chat_messages: [] }) };
const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 }
};

function steppedModel() {
  const tail = new Promise<void>((resolve) => (releaseTail = resolve));
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      call++;
      const first = call === 1;
      return {
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            if (first) {
              controller.enqueue({ type: 'text-start', id: 'a' });
              controller.enqueue({ type: 'text-delta', id: 'a', delta: 'Looking.' });
              controller.enqueue({ type: 'text-end', id: 'a' });
              controller.enqueue({ type: 'tool-call', toolCallId: 'c1', toolName: 'list_nodes', input: '{}' });
              controller.enqueue({ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: USAGE });
              controller.close();
              return;
            }
            await tail;
            if (world.fails) {
              controller.error(new Error('provider down'));
              return;
            }
            controller.enqueue({ type: 'text-start', id: 'b' });
            controller.enqueue({ type: 'text-delta', id: 'b', delta: 'Done.' });
            controller.enqueue({ type: 'text-end', id: 'b' });
            controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: USAGE });
            controller.close();
          }
        })
      };
    }
  });
}

function slowModel() {
  const tail = new Promise<void>((resolve) => (releaseTail = resolve));
  return new MockLanguageModelV4({
    doStream: async () => {
      streamed();
      return {
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'Created ' });
          await tail;
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'the doc.' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 1, text: 1, reasoning: 0 }
            }
          });
          controller.close();
        }
      })
      };
    }
  });
}

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: () => (world.stepped ? steppedModel() : slowModel())
}));
vi.mock('$lib/server/openrouter-models', () => ({
  ensureGatewayModels: async () => {},
  gatewayRate: () => ({ input: world.usdPerToken * 1_000_000, cachedInput: 0, output: world.usdPerToken * 1_000_000 })
}));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => []
}));
vi.mock('$lib/server/ai-log', () => ({
  extractSdkUsage: () => ({ inputTokens: 1, outputTokens: 1 }),
  logAiCall: vi.fn(),
  withBrandContext: (_id: string, fn: () => void) => fn(),
  withOrgContext: (_id: string, fn: () => void) => fn()
}));
vi.mock('$lib/server/cli-auth', () => ({
  gateAiAction: async () => null,
  gateOrgAiAction: async () => null
}));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()), listCanvases: async () => [{ id: 'c-1', name: 'Ideas' }] }));
const delegated = vi.hoisted(() => ({ canvasId: undefined as string | null | undefined }));
vi.mock('$lib/server/project-agent/motion-delegation', async (importOriginal) => {
  const real = await importOriginal<typeof import('$lib/server/project-agent/motion-delegation')>();
  return {
    ...real,
    createMotionDelegation: (deps: Parameters<typeof real.createMotionDelegation>[0]) => {
      delegated.canvasId = deps.canvasId;
      return real.createMotionDelegation(deps);
    }
  };
});
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: async () => ({ orgId: 'org-1', project: { id: 'p-1', name: 'P', brandId: null } })
}));
vi.mock('$lib/server/repos/chat', () => ({
  openThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  turnRunning: async () => true,
  saveTurn: (db: unknown, turn: { role: string }) => saveTurn(db, turn)
}));
vi.mock('$lib/server/project-agent/project-tools', () => ({ createProjectTools: () => ({}) }));
const offeredProjectTools = vi.hoisted(() => ({ names: [] as string[] }));
vi.mock('$lib/server/project-agent/tool-surface', () => ({
  openAgentTools: async (input: { projectTools: Record<string, unknown> }) => {
    offeredProjectTools.names = Object.keys(input.projectTools);
    return { tools: { list_nodes: tool({ inputSchema: z.object({}), execute: async () => ({ n: 2 }) }) }, close: async () => undefined };
  }
}));

const { GET, POST } = await import('./+server');
const { MOTION_DELEGATION_TOOLS } = await import('$lib/server/project-agent/motion-delegation');

function postEvent(extra: Record<string, unknown> = {}) {
  const request = new Request('http://x/api/v1/projects/p-1/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'make a doc', ...extra })
  });
  const locals = {
    safeGetSession: async () => ({ session: { access_token: 'tok' }, user: { id: 'u-1' } }),
    db: async () => world.db.db
  };
  return { request, url: new URL(request.url), params: { projectId: 'p-1' }, locals } as unknown as Parameters<typeof POST>[0];
}

const replyWrites = (calls: Call[]) => calls.filter((c) => c.table === 'chat_messages' && c.op === 'update').map((c) => c.payload as { content: string; status: string; tool_calls: unknown });

async function settled(calls: Call[], status: string) {
  for (let i = 0; i < 100; i++) {
    if (replyWrites(calls).some((w) => w.status === status)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('POST /api/v1/projects/[projectId]/agent', () => {
  beforeEach(() => {
    saveTurn.mockClear();
    streamed.mockClear();
    forgetReplySchema();
    world.stepped = false;
    world.db = fakeDb({ chat_messages: [] });
    screenModelInput.mockReset();
    screenModelInput.mockResolvedValue({ ok: true });
  });

  it('refuses a sexual message before the model sees it, and saves no turn', async () => {
    const blocked = "This prompt was blocked: sexual content isn't allowed in feega's standard mode.";
    screenModelInput.mockResolvedValue({ ok: false, error: blocked });

    const res = await POST(postEvent());

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: blocked, code: 'prompt_blocked' });
    expect(streamed).not.toHaveBeenCalled();
    expect(saveTurn).not.toHaveBeenCalled();
    expect(screenModelInput.mock.calls[0][1]).toMatchObject({ profile: 'standard', texts: ['make a doc'], scope: { orgId: 'org-1', userId: 'u-1', projectId: 'p-1' } });
  });

  it('hands the canvas agent the motion delegation tools', async () => {
    await POST(postEvent());

    expect(offeredProjectTools.names).toEqual(expect.arrayContaining([...MOTION_DELEGATION_TOOLS]));
  });

  it('hands the motion delegation the canvas the user has open', async () => {
    await POST(postEvent({ canvasId: 'c-1' }));

    expect(delegated.canvasId).toBe('c-1');
  });

  it('ignores an open canvas that is not in this project', async () => {
    await POST(postEvent({ canvasId: 'c-elsewhere' }));

    expect(delegated.canvasId).toBeNull();
  });

  it('salva la risposta anche se il client chiude la connessione a metà turno', async () => {
    const res = await POST(postEvent());
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();

    releaseTail();
    await settled(world.db.calls, 'done');

    expect(replyWrites(world.db.calls).at(-1)).toMatchObject({ content: 'Created the doc.', status: 'done' });
  });
});

describe('POST — the answer is written while the turn runs', () => {
  beforeEach(() => {
    forgetReplySchema();
    world.stepped = true;
    world.fails = false;
    world.usdPerToken = 0;
    world.db = fakeDb({ chat_messages: [] });
    screenModelInput.mockResolvedValue({ ok: true });
  });

  it('a finished step is on the database before the turn ends, then the row turns done', async () => {
    const res = await POST(postEvent());
    await res.body!.getReader().cancel();
    await settled(world.db.calls, 'streaming');

    const opened = world.db.calls.find((c) => c.op === 'insert' && (c.payload as { role: string }).role === 'assistant');
    expect(opened?.payload).toMatchObject({ status: 'streaming', content: '' });
    expect(replyWrites(world.db.calls)).toEqual([expect.objectContaining({ content: 'Looking.', status: 'streaming', tool_calls: [expect.objectContaining({ toolName: 'list_nodes', status: 'done' })] })]);

    releaseTail();
    await settled(world.db.calls, 'done');

    expect(replyWrites(world.db.calls).at(-1)).toMatchObject({ content: 'Looking.\n\nDone.', status: 'done' });
  });

  it('a turn that spent its cap stops after the step that crossed it', async () => {
    world.usdPerToken = AGENT_TURN_CAP_USD;
    const res = await POST(postEvent());
    await res.body!.getReader().cancel();

    await settled(world.db.calls, 'done');

    expect(replyWrites(world.db.calls).at(-1)).toMatchObject({ content: 'Looking.', status: 'done' });
  });

  it('a turn that breaks after a step keeps the step and ends failed', async () => {
    world.fails = true;
    const res = await POST(postEvent());
    await res.body!.getReader().cancel();
    await settled(world.db.calls, 'streaming');

    releaseTail();
    await settled(world.db.calls, 'failed');

    expect(replyWrites(world.db.calls).at(-1)).toMatchObject({ content: 'Looking.', status: 'failed' });
  });
});

describe('GET /api/v1/projects/[projectId]/agent', () => {
  it('says the turn is still running, so a client coming back follows it instead of failing', async () => {
    const res = await GET(postEvent() as unknown as Parameters<typeof GET>[0]);

    expect(await res.json()).toMatchObject({ threadId: 'thread-1', running: true });
  });
});
