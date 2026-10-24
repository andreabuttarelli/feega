import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { CostTier, type ChatModelOption } from '$lib/chat-model';

const ORG = 'org-1';
const PROJECT = 'p-1';
const THREAD = 'thread-1';

const calls = vi.hoisted(() => ({ stopped: false, finished: [] as string[], stops: [] as unknown[] }));

function hangingModel() {
  return new MockLanguageModelV4({
    doStream: async (options) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 't' } as never);
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'Working' } as never);
          options.abortSignal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
        }
      })
    })
  });
}

const OFFERED: ChatModelOption[] = [{ id: 'anthropic/claude-opus-5.5', label: 'X', provider: 'anthropic', costTier: CostTier.Low, inputUsdPerM: 1, outputUsdPerM: 1, efforts: [], defaultEffort: null }];

vi.mock('$lib/server/agents/turn-core', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/agents/turn-core')>()), PLATFORM_TIMING: { landingMs: 60_000, stopPollMs: 10 } }));
vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()), offeredChatModels: async () => OFFERED }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/llm', () => ({ llmLanguageModel: () => hangingModel() }));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({}), logAiCall: () => undefined, withBrandContext: (_id: string, fn: () => void) => fn(), withOrgContext: (_id: string, fn: () => void) => fn() }));
vi.mock('$lib/server/cli-auth', () => ({ gateAiAction: async () => null, gateOrgAiAction: async () => null }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: async () => ({ orgId: ORG, project: { id: PROJECT, name: 'P', brandId: null, mode: 'standard' } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()), listCanvases: async () => [] }));
vi.mock('$lib/server/repos/chat', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat')>()),
  openThread: async () => THREAD,
  loadTurns: async () => [],
  saveTurn: async () => undefined
}));
vi.mock('$lib/server/repos/chat-reply', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat-reply')>()),
  openReply: async () => ({
    progress: async () => undefined,
    finish: async (_body: unknown, status: string) => {
      calls.finished.push(status);
    },
    stopped: async () => calls.stopped
  }),
  stopTurn: async (_db: unknown, scope: unknown) => {
    calls.stops.push(scope);
  }
}));
vi.mock('$lib/server/project-agent/project-tools', () => ({ createProjectTools: () => ({}) }));
vi.mock('$lib/server/project-agent/tool-surface', () => ({ openAgentTools: async (input: { projectTools: object }) => ({ tools: input.projectTools, close: async () => undefined }) }));

const { POST, DELETE } = await import('./+server');

const locals = { safeGetSession: async () => ({ session: { access_token: 'tok' }, user: { id: 'u-1' } }), db: async () => ({ storage: { from: () => ({}) } }) };

function post() {
  const request = new Request(`http://x/api/v1/projects/${PROJECT}/agent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'write a long plan' }) });
  return POST({ request, url: new URL(request.url), params: { projectId: PROJECT }, locals } as never);
}

beforeEach(() => {
  calls.stopped = false;
  calls.finished.length = 0;
  calls.stops.length = 0;
});

describe('the Stop button on the canvas chat', () => {
  it('DELETE stops the running reply of this project thread', async () => {
    const res = await DELETE({ request: new Request('http://x', { method: 'DELETE' }), params: { projectId: PROJECT }, locals } as never);

    expect(await res.json()).toEqual({ stopped: true });
    expect(calls.stops).toEqual([{ orgId: ORG, threadId: THREAD }]);
  });

  it('a stopped reply lands the turn instead of running on', async () => {
    const res = await post();
    calls.stopped = true;

    await res.text();

    expect(calls.finished[0]).toBe('done');
  });
});
