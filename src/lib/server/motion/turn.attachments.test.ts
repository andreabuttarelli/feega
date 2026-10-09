import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import sharp from 'sharp';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { fakeDb } from '$lib/server/db/fake-db';
import { AttachmentKind } from '$lib/chat-attachments';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
const prompts = vi.hoisted(() => [] as unknown[]);
const saved = vi.hoisted(() => [] as unknown[]);

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: () =>
    new MockLanguageModelV4({
      doStream: async (options) => {
        prompts.push(options.prompt);
        return {
          stream: new ReadableStream({
            start(controller) {
              [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'Placed.' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
              ].forEach((p) => controller.enqueue(p as never));
              controller.close();
            }
          })
        };
      }
    }),
  llmCodeModel: () => 'code/model',
  llmVisionModel: () => null
}));
vi.mock('$lib/server/openrouter-models', () => ({ ensureGatewayModels: async () => undefined, gatewayRate: () => ({ input: 1, cachedInput: 0.1, output: 1 }), gatewayModel: () => null }));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({ inputTokens: 10, outputTokens: 5 }), logAiCall: vi.fn(), withOrgContext: (_id: string, fn: () => unknown) => fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/repos/chat', () => ({ openNodeThread: async () => 'thread-1', loadTurns: async () => [], promptHistory: () => [], saveTurn: async (_db: unknown, turn: unknown) => void saved.push(turn) }));
vi.mock('$lib/server/repos/chat-reply', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat-reply')>()),
  openReply: async () => ({ progress: async () => undefined, finish: async () => undefined, stopped: async () => false })
}));
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

describe('a motion turn with attachments', () => {
  it('the model reads the image and its asset id, and the message is saved with it', async () => {
    const png = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#00f' } }).png().toBuffer());
    const { db } = fakeDb(
      { assets: [{ id: 'a-img', project_id: 'p-1', type: 'image', url: 'o-1/p-1/chat/u__logo.png', content: null, mime_type: 'image/png', bytes: 5, width: 8, height: 8, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-09' }] },
      { files: { 'o-1/p-1/chat/u__logo.png': png } }
    );
    const logo = { assetId: 'a-img', kind: AttachmentKind.Image, name: 'logo.png', mimeType: 'image/png', bytes: 5 };
    const motion = { record: { id: 'n-1', canvasId: 'c-1' }, node: { id: 'n-1', format: MotionFormat.Landscape, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } as never;

    const started = await startMotionTurn({ db, userId: 'u-1', orgId: 'o-1', project: { id: 'p-1', brandId: null } as never, motion, message: 'use this logo', attachments: [logo], selection: [], model: 'm', reasoning: null, requester: { kind: 'user', id: 'u-1' }, browser: Browser.Absent });
    if (started instanceof Response) {
      throw new Error('turn refused');
    }
    const reader = started.stream.getReader();
    while (!(await reader.read()).done) {
      continue;
    }
    await started.done;

    const user = (prompts[0] as { role: string; content: { type: string; text?: string; mediaType?: string }[] }[]).at(-1)!;
    expect(user.content.map((p) => p.type)).toEqual(['text', 'text', 'file']);
    expect(user.content[1].text).toMatch(/asset a-img.*use that asset id/);
    expect(saved[0]).toMatchObject({ role: 'user', content: 'use this logo', attachments: [logo] });
  });
});
