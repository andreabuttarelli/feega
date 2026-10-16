import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import sharp from 'sharp';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { fakeDb } from '$lib/server/db/fake-db';
import { AttachmentKind } from '$lib/chat-attachments';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
const prompts = vi.hoisted(() => [] as unknown[]);
const saved = vi.hoisted(() => [] as unknown[]);
const offered = vi.hoisted(() => [] as string[][]);
const commits = vi.hoisted(() => [] as { doc: { width: number; height: number; durationInFrames: number; fps: number } }[]);
const patches = vi.hoisted(() => [] as { patch: Record<string, unknown> }[]);
const head = vi.hoisted(() => ({ format: 'landscape' as string }));

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: () =>
    new MockLanguageModelV4({
      doStream: async (options) => {
        prompts.push(options.prompt);
        offered.push((options.tools ?? []).map((t: { name: string }) => t.name));
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
vi.mock('$lib/server/openrouter-models', () => ({ gatewayModels: () => [], ensureGatewayModels: async () => undefined, gatewayRate: () => ({ input: 1, cachedInput: 0.1, output: 1 }), gatewayModel: () => null }));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({ inputTokens: 10, outputTokens: 5 }), logAiCall: vi.fn(), billingScope: () => ({ run: (fn: () => unknown) => fn(), gatewayUsd: () => 0 }), withOrgContext: (_id: string, fn: () => unknown) => fn(), withNodeContext: (_n: string, fn: () => unknown) => fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/repos/chat', () => ({ openNodeThread: async () => 'thread-1', loadTurns: async () => [], promptHistory: () => [], saveTurn: async (_db: unknown, turn: unknown) => void saved.push(turn) }));
vi.mock('$lib/server/repos/chat-reply', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat-reply')>()),
  openReply: async () => ({ progress: async () => undefined, finish: async () => undefined, stopped: async () => false })
}));
vi.mock('$lib/server/motion/editor', () => ({
  headOrNew: async () => ({ version: 0, doc: newMotionDoc(head.format === 'vertical' ? MotionFormat.Vertical : MotionFormat.Landscape), summary: null, actorKind: 'system' }),
  motionTokens: async () => ({ name: 'Brand' }),
  motionAssets: async () => [],
  assetUrls: () => ({}),
  saveMotionDoc: async () => null
}));
vi.mock('$lib/server/motion/frame-ops', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/motion/frame-ops')>()),
  commitDoc: async (_db: unknown, input: (typeof commits)[number]) => (commits.push(input), null),
  revisionWriteOf: () => ({ outcome: 'conflict' })
}));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: async (_db: unknown, input: (typeof patches)[number]) => (patches.push(input), { outcome: 'written' })
}));
vi.mock('$lib/server/video-reference', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/video-reference')>()),
  videoGrabber: async () => async () => (await import('sharp')).default({ create: { width: 16, height: 9, channels: 3, background: '#c80010' } }).jpeg().toBuffer()
}));
vi.mock('$lib/server/motion/templates', () => ({ templateLibrary: () => ({ list: async () => [] }) }));
vi.mock('$lib/server/motion/brand-sources', () => ({ brandSources: () => ({}) }));

const { startMotionTurn, Browser } = await import('./turn');
const { breakdownPath } = await import('$lib/server/video-reference');
const { REPLICA_BRIEF } = await import('$lib/motion/replica');

async function drain(started: Awaited<ReturnType<typeof startMotionTurn>>) {
  if (started instanceof Response) {
    throw new Error('turn refused');
  }
  const reader = started.stream.getReader();
  while (!(await reader.read()).done) {
    continue;
  }
  await started.done;
}

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

  it('recreating an attached 16:9 reference sets the canvas to 16:9 and its duration, marks the video a replica and briefs a scene-by-scene build (live test: Cautiva came out 9:16)', async () => {
    head.format = 'vertical';
    prompts.length = 0;
    offered.length = 0;
    const breakdown = { durationS: 10.1, aspectRatio: '16:9', scenes: [{ start: 0, end: 2.6, onScreenText: ['CAUTIVA'] }], pacing: { cutsPerMinute: 30, rhythm: 'fast' } };
    const { db } = fakeDb(
      { assets: [{ id: 'a-vid', project_id: 'p-1', type: 'video', url: 'o-1/p-1/chat/u__ref.mp4', content: null, mime_type: 'video/mp4', bytes: 5, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, uncensored: false, created_at: '2026-10-16' }] },
      { files: { [breakdownPath({ orgId: 'o-1', projectId: 'p-1', assetId: 'a-vid' })]: new TextEncoder().encode(JSON.stringify(breakdown)) } }
    );
    const ref = { assetId: 'a-vid', kind: AttachmentKind.Video, name: 'kinetic-cautiva.mp4', mimeType: 'video/mp4', bytes: 5 };
    const motion = { record: { id: 'n-2', canvasId: 'c-1' }, node: { id: 'n-2', format: MotionFormat.Vertical, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } as never;

    await drain(await startMotionTurn({ db, userId: 'u-1', orgId: 'o-1', project: { id: 'p-1', brandId: null, mode: 'standard' } as never, motion, message: 'Recreate this video as faithfully as possible', attachments: [ref], selection: [], model: 'm', reasoning: null, requester: { kind: 'user', id: 'u-1' }, browser: Browser.Absent }));

    const user = (prompts[0] as { role: string; content: { type: string; text?: string }[] }[]).at(-1)!;
    expect(user.content[0].text).toContain(REPLICA_BRIEF);
    expect(user.content[1].text).toContain('CAUTIVA');
    expect(patches.at(-1)?.patch).toEqual({ replicaOf: 'a-vid' });
    expect(user.content.filter((p) => p.type === 'text' && p.text?.startsWith('Reference frame')).map((p) => p.text)).toEqual(['Reference frame — scene 1 at 0.2 s:', 'Reference frame — scene 1 at 1.3 s:', 'Reference frame — scene 1 at 2.4 s:']);
    expect(user.content.filter((p) => p.type === 'file')).toHaveLength(3);
    expect(offered[0]).toContain('compare_to_reference');
    expect(offered[0]).not.toContain('add_template');
    expect(offered[0]).not.toContain('add_shot');
    expect(commits.at(-1)?.doc).toMatchObject({ width: 1920, height: 1080 });
    expect(commits.at(-1)?.doc.durationInFrames).toBe(Math.round(10.1 * commits.at(-1)!.doc.fps));
  });
});
