import { describe, expect, it, vi } from 'vitest';

const motionAssets = vi.fn(async () => []);

vi.mock('$lib/server/repos/canvas', () => ({ findNode: async () => ({ id: 'n1', projectId: 'p1', canvasId: 'c1', displayName: 'Cut', type: 'motion', data: {} }) }));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'p1', brandId: null, mode: 'standard' }) }));
vi.mock('$lib/canvas/motion-node', () => ({ motionOf: () => ({ format: 'landscape' }) }));
vi.mock('./editor', () => ({
  motionAssets,
  assetUrls: () => ({}),
  motionTokens: async () => ({}),
  headOrNew: async () => ({ version: 2, doc: { assets: [] } })
}));
vi.mock('./embed', () => ({ publishEmbed: async () => ({ ok: true, url: 'u', snippet: 's' }), embedPublished: async () => true, isRefused: () => false, removeEmbed: async () => ({ ok: true }) }));

const { publishMotionEmbed } = await import('./agent-embed');

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
});
