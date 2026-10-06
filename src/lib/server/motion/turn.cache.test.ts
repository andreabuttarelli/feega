import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { PromptCache } from '$lib/server/prompt-cache';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };

const caches = vi.hoisted(() => [] as unknown[]);

function answering() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'Nothing to change.' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
          ].forEach((p) => controller.enqueue(p as never));
          controller.close();
        }
      })
    })
  });
}

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: (_id: string, cache: unknown) => {
    caches.push(cache);
    return answering();
  },
  llmCodeModel: () => 'code/model',
  llmVisionModel: () => null
}));
vi.mock('$lib/server/openrouter-models', () => ({ ensureGatewayModels: async () => undefined, gatewayRate: () => ({ input: 1, cachedInput: 0.1, output: 1 }), gatewayModel: () => null }));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({ inputTokens: 10, outputTokens: 5 }), logAiCall: vi.fn(), withOrgContext: (_id: string, fn: () => unknown) => fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/repos/chat', () => ({ openNodeThread: async () => 'thread-1', loadTurns: async () => [], promptHistory: () => [], saveTurn: async () => undefined }));
vi.mock('$lib/server/motion/editor', () => ({
  headOrNew: async () => ({ version: 0, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'system' }),
  motionTokens: async () => ({ name: 'Brand' }),
  motionAssets: async () => [],
  assetUrls: () => ({}),
  saveMotionDoc: async () => null
}));
vi.mock('$lib/server/motion/templates', () => ({ templateLibrary: () => ({ list: async () => [] }) }));
vi.mock('$lib/server/motion/brand-sources', () => ({ brandSources: () => ({}) }));

const { startMotionTurn, Browser } = await import('./turn');

async function turn() {
  const db = { storage: { from: () => ({}) } } as never;
  const motion = { record: { id: 'n-1', canvasId: 'c-1' }, node: { id: 'n-1', format: MotionFormat.Landscape, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } as never;
  const started = await startMotionTurn({ db, userId: 'u-1', orgId: 'o-1', project: { id: 'p-1', brandId: null }, motion, message: 'make it pop', selection: [], model: 'anthropic/claude-opus-5.5', reasoning: 'low', requester: { kind: 'user', id: 'u-1' }, browser: Browser.Absent });
  if (started instanceof Response) {
    throw new Error('turn refused');
  }
  const reader = started.stream.getReader();
  while (!(await reader.read()).done) {
    continue;
  }
  return started.done;
}

describe('a motion turn reads its shared prefix from the prompt cache', () => {
  it('every step of the turn asks for the cache', async () => {
    await turn();

    expect(caches.length).toBeGreaterThan(0);
    expect(new Set(caches)).toEqual(new Set([PromptCache.On]));
  });
});
