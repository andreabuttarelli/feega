import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

const streamed = vi.fn();
const { screenModelInput } = vi.hoisted(() => ({ screenModelInput: vi.fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput }));

const saveTurn = vi.fn(async (_db: unknown, _turn: { role: string; content?: string }) => undefined);

let releaseTail: () => void = () => {};

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
  llmModelForPicker: () => 'mock-model',
  llmLanguageModel: () => slowModel()
}));
vi.mock('$lib/server/ai-log', () => ({
  extractSdkUsage: () => ({}),
  logAiCall: vi.fn(),
  withBrandContext: (_id: string, fn: () => void) => fn(),
  withOrgContext: (_id: string, fn: () => void) => fn()
}));
vi.mock('$lib/server/cli-auth', () => ({
  gateAiAction: async () => null,
  gateOrgAiAction: async () => null
}));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/repos/canvas', () => ({ listCanvases: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({
  findReachableProject: async () => ({ orgId: 'org-1', project: { id: 'p-1', name: 'P', brandId: null } })
}));
vi.mock('$lib/server/repos/chat', () => ({
  openThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  saveTurn: (db: unknown, turn: { role: string }) => saveTurn(db, turn)
}));
vi.mock('$lib/server/project-agent/project-tools', () => ({ createProjectTools: () => ({}) }));
vi.mock('$lib/server/project-agent/tool-surface', () => ({
  openAgentTools: async () => ({ tools: {}, close: async () => undefined })
}));

const { POST } = await import('./+server');

function postEvent() {
  const request = new Request('http://x/api/v1/projects/p-1/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'make a doc' })
  });
  const locals = {
    safeGetSession: async () => ({ session: { access_token: 'tok' }, user: { id: 'u-1' } }),
    db: async () => ({})
  };
  return { request, params: { projectId: 'p-1' }, locals } as unknown as Parameters<typeof POST>[0];
}

async function assistantSaved() {
  for (let i = 0; i < 50; i++) {
    const saved = saveTurn.mock.calls.find(([, t]) => t.role === 'assistant');
    if (saved) {
      return saved[1];
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  return null;
}

describe('POST /api/v1/projects/[projectId]/agent', () => {
  beforeEach(() => {
    saveTurn.mockClear();
    streamed.mockClear();
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

  it('salva la risposta anche se il client chiude la connessione a metà turno', async () => {
    const res = await POST(postEvent());
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();

    releaseTail();

    const saved = await assistantSaved();
    expect(saved?.content).toBe('Created the doc.');
  });
});
