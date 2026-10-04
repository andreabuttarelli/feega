import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { CostTier, type ChatModelOption } from '$lib/chat-model';

const calls = vi.hoisted(() => ({ models: [] as string[], providerOptions: [] as unknown[], logged: [] as Array<{ model?: string }> }));

function finishingModel() {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      calls.providerOptions.push(options.providerOptions);
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
  option({ id: 'anthropic/claude-sonnet-5.5', provider: 'anthropic', efforts: ['high', 'medium', 'low'], defaultEffort: 'high' }),
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
  withOrgContext: (_id: string, fn: () => void) => fn()
}));
vi.mock('$lib/server/cli-auth', () => ({ gateAiAction: async () => null, gateOrgAiAction: async () => null }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/repos/canvas', () => ({ listCanvases: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: async () => ({ orgId: 'org-1', project: { id: 'p-1', name: 'P', brandId: null } })
}));
vi.mock('$lib/server/repos/chat', () => ({
  openThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  saveTurn: async () => undefined
}));
vi.mock('$lib/server/project-agent/project-tools', () => ({ createProjectTools: () => ({}) }));
vi.mock('$lib/server/project-agent/tool-surface', () => ({ openAgentTools: async () => ({ tools: {}, close: async () => undefined }) }));

const { POST } = await import('./+server');

function postEvent(body: Record<string, unknown>) {
  const request = new Request('http://x/api/v1/projects/p-1/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hi', ...body })
  });
  const locals = { safeGetSession: async () => ({ session: { access_token: 'tok' }, user: { id: 'u-1' } }), db: async () => ({}) };
  return { request, params: { projectId: 'p-1' }, locals } as unknown as Parameters<typeof POST>[0];
}

async function settled(res: Response) {
  await res.text();
  for (let i = 0; i < 50 && !calls.logged.length; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('the project agent runs the model the user chose', () => {
  beforeEach(() => {
    calls.models.length = 0;
    calls.providerOptions.length = 0;
    calls.logged.length = 0;
  });

  it('no choice: the default model at medium, billed as that model', async () => {
    await settled(await POST(postEvent({})));
    expect(calls.models).toEqual(['anthropic/claude-sonnet-5.5']);
    expect(calls.providerOptions[0]).toMatchObject({ openai: { reasoningEffort: 'medium', forceReasoning: true } });
    expect(calls.logged[0]?.model).toBe('anthropic/claude-sonnet-5.5');
  });

  it('a chosen model and effort reach the wire', async () => {
    await settled(await POST(postEvent({ model: 'anthropic/claude-sonnet-5.5', reasoning: 'low' })));
    expect(calls.providerOptions[0]).toMatchObject({ openai: { reasoningEffort: 'low' } });
  });

  it('a model without reasoning control sends no reasoning', async () => {
    await settled(await POST(postEvent({ model: 'mistralai/plain' })));
    expect(calls.models).toEqual(['mistralai/plain']);
    expect(calls.providerOptions[0]).not.toHaveProperty('openai.reasoningEffort');
  });

  it('refuses a model the catalogue does not offer, before spending', async () => {
    const res = await POST(postEvent({ model: 'evil/expensive' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown_model' });
    expect(calls.models).toEqual([]);
  });

  it('refuses an effort the model does not declare', async () => {
    const res = await POST(postEvent({ model: 'mistralai/plain', reasoning: 'high' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unsupported_reasoning' });
  });
});
