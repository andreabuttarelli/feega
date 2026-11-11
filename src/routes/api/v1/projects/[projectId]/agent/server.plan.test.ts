import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { CostTier, type ChatModelOption } from '$lib/chat-model';

const calls = vi.hoisted(() => ({ unbilled: 0, gate: null as Response | null, turns: 0, models: [] as string[], providerOptions: [] as unknown[], logged: [] as Array<{ model?: string }>, systems: [] as string[] }));

function finishingModel() {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      calls.providerOptions.push(options.providerOptions);
      calls.systems.push(JSON.stringify(options.prompt.filter((m) => m.role === 'system')));
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 't' });
            controller.enqueue({ type: 'text-delta', id: 't', delta: 'ok' });
            controller.enqueue({ type: 'text-end', id: 't' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
            });
            controller.close();
          }
        })
      };
    }
  });
}

const option = (over: Partial<ChatModelOption>): ChatModelOption => ({
  id: 'x/y',
  label: 'X: Y',
  provider: 'x',
  costTier: CostTier.Low,
  inputUsdPerM: 1,
  outputUsdPerM: 1,
  efforts: [],
  defaultEffort: null,
  ...over
});

const OFFERED = [
  option({ id: 'anthropic/claude-haiku-4.5', provider: 'anthropic' }),
  option({ id: 'anthropic/claude-opus-5.5', provider: 'anthropic', efforts: ['high', 'medium', 'low'], defaultEffort: 'high' }),
  option({ id: 'mistralai/plain', provider: 'mistralai' })
];

vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => OFFERED
}));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: (id: string) => {
    calls.models.push(id);
    return finishingModel();
  }
}));
vi.mock('$lib/server/ai-log', () => ({
  extractSdkUsage: () => ({}),
  logAiCall: (entry: { model?: string }) => calls.logged.push(entry),
  withBrandContext: (_id: string, fn: () => void) => fn(),
  withOrgContext: (_id: string, fn: () => void) => fn(),
  withoutDebit: <T>(fn: () => T): T => {
    calls.unbilled += 1;
    return fn();
  }
}));
vi.mock('$lib/server/cli-auth', () => ({ gateAiAction: async () => calls.gate, gateOrgAiAction: async () => calls.gate }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()), listCanvases: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: async () => ({ orgId: 'org-1', project: { id: 'p-1', name: 'P', brandId: null } })
}));
vi.mock('$lib/server/repos/chat', () => ({
  openThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  saveTurn: async () => undefined,
  countUserTurns: async () => calls.turns
}));
vi.mock('$lib/server/project-agent/project-tools', () => ({ createProjectTools: () => ({}) }));
vi.mock('$lib/server/project-agent/tool-surface', () => ({ openAgentTools: async () => ({ tools: {}, close: async () => undefined }) }));

const { POST } = await import('./+server');

const NO_CREDITS = 402;

function postEvent(body: Record<string, unknown>) {
  const request = new Request('http://x/api/v1/projects/p-1/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Design a launch video for a bakery', ...body }) });
  const locals = { safeGetSession: async () => ({ session: { access_token: 'tok' }, user: { id: 'u-1' } }), db: async () => ({}) };
  return { request, url: new URL(request.url), params: { projectId: 'p-1' }, locals } as unknown as Parameters<typeof POST>[0];
}

async function settled(res: Response) {
  await res.text();
  for (let i = 0; i < 50 && !calls.logged.length; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('the agent runs on the plan of who pays', () => {
  beforeEach(() => {
    calls.models.length = 0;
    calls.logged.length = 0;
    calls.gate = null;
    calls.turns = 0;
    calls.unbilled = 0;
  });

  it('a paid plan runs Opus 5.5', async () => {
    await settled(await POST(postEvent({})));
    expect(calls.models).toEqual(['anthropic/claude-opus-5.5']);
  });

  it('a free plan runs Haiku, whatever model was asked', async () => {
    calls.gate = new Response('{}', { status: NO_CREDITS });
    await settled(await POST(postEvent({ model: 'anthropic/claude-opus-5.5' })));
    expect(calls.models).toEqual(['anthropic/claude-haiku-4.5']);
    expect(calls.unbilled).toBe(1);
  });

  it('a paid turn is debited as usual', async () => {
    await settled(await POST(postEvent({})));
    expect(calls.unbilled).toBe(0);
  });

  it('a free plan stops at 20 turns with the paywall, before spending', async () => {
    calls.gate = new Response('{"error":"credits"}', { status: NO_CREDITS });
    calls.turns = 20;
    const res = await POST(postEvent({}));
    expect(res.status).toBe(NO_CREDITS);
    expect(calls.models).toEqual([]);
  });

  it('the 20th free turn still runs', async () => {
    calls.gate = new Response('{}', { status: NO_CREDITS });
    calls.turns = 19;
    await settled(await POST(postEvent({})));
    expect(calls.models).toEqual(['anthropic/claude-haiku-4.5']);
  });
});
