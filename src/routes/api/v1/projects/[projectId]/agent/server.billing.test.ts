import { describe, it, expect, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

const seen = vi.hoisted(() => ({ invoice: [] as Array<number | undefined> }));
const GATEWAY_INVOICE_USD = 0.0123;

vi.mock('$lib/server/ai-log', async (importOriginal) => {
  const real = await importOriginal<typeof import('$lib/server/ai-log')>();
  return { ...real, logAiCall: () => seen.invoice.push(real.takeLlmCost()) };
});
vi.mock('$lib/server/llm', async () => {
  const { noteLlmCost } = await import('$lib/server/ai-log');
  return {
    llmLanguageModel: () =>
      new MockLanguageModelV4({
        doStream: async () => {
          noteLlmCost(GATEWAY_INVOICE_USD);
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
                  usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 9, text: 1, reasoning: 8 } }
                });
                controller.close();
              }
            })
          };
        }
      })
  };
});
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()),
  offeredChatModels: async () => []
}));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
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

describe('the project agent bills the gateway invoice', () => {
  it('the cost the gateway reported during the turn reaches the log row, reasoning included', async () => {
    const request = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'hi' }) });
    const locals = { safeGetSession: async () => ({ session: { access_token: 't' }, user: { id: 'u-1' } }), db: async () => ({}) };
    const res = await POST({ request, params: { projectId: 'p-1' }, locals } as unknown as Parameters<typeof POST>[0]);
    await res.text();
    for (let i = 0; i < 50 && !seen.invoice.length; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(seen.invoice).toEqual([GATEWAY_INVOICE_USD]);
  });
});
