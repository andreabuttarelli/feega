import { describe, expect, it, vi } from 'vitest';

const motionAssets = vi.fn(async () => []);

vi.mock('$lib/server/repos/canvas', () => ({ findNode: async () => ({ id: 'n1', projectId: 'p1', canvasId: 'c1', displayName: 'Cut', type: 'motion', data: {} }) }));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'p1', brandId: null, mode: 'standard' }) }));
vi.mock('$lib/canvas/motion-node', () => ({ motionOf: () => ({ format: 'landscape' }) }));
vi.mock('./editor', () => ({
  motionAssets,
  assetUrls: () => ({}),
  motionTokens: async () => ({}),
  newHead: () => ({ version: 0, doc: { assets: [] } })
}));
const heads = new Map<string, unknown>();
const publishEmbed = vi.fn(async (..._args: unknown[]) => ({ ok: true, url: 'u', snippet: 's' }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ readHead: async (_db: unknown, scope: { nodeId: string }) => ({ version: 2, doc: heads.get(scope.nodeId) ?? { assets: [], tracks: [] } }) }));
vi.mock('./embed', () => ({ publishEmbed, embedPublished: async () => true, isRefused: () => false, removeEmbed: async () => ({ ok: true }) }));

const { publishMotionEmbed } = await import('./agent-embed');
const { MotionFormat, newMotionDoc } = await import('$lib/motion/doc');
const { addClip } = await import('$lib/motion/timeline');
const { sequenceScenes } = await import('$lib/motion/scenes');
const { motionCompId } = await import('$lib/motion/embed');

describe('publishMotionEmbed', () => {
  it('signs the assets with the signer it is given', async () => {
    const sign = vi.fn();
    const answer = await publishMotionEmbed({} as never, { orgId: 'o1', nodeId: 'n1', sign }, 'https://x');

    expect(answer.ok).toBe(true);
    expect(motionAssets).toHaveBeenCalledWith(expect.objectContaining({ sign }));
  });

  it('leaves signing to the member check when none is given', async () => {
    await publishMotionEmbed({} as never, { orgId: 'o1', nodeId: 'n1' }, 'https://x');

    expect(motionAssets).toHaveBeenLastCalledWith(expect.objectContaining({ sign: undefined }));
  });

  it('publishes a combined video with its scenes inside, read from their own heads', async () => {
    const scene = '11111111-1111-4111-8111-111111111111';
    const made = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'hi' } }, 'title');
    heads.set(scene, made.ok ? made.doc : null);
    heads.set('n1', sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: scene, durationInFrames: 30 }]));

    await publishMotionEmbed({} as never, { orgId: 'o1', nodeId: 'n1' }, 'https://x');

    const sent = publishEmbed.mock.lastCall?.[1] as { doc: { comps: Record<string, unknown> } };
    expect(Object.keys(sent.doc.comps)).toContain(motionCompId(scene));
    heads.clear();
  });
});
