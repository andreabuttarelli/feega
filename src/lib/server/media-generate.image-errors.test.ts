import { describe, it, expect, vi } from 'vitest';
import { CreditsExhaustedError } from './credits';

vi.mock('$lib/server/ai-log', () => ({ withOrgContext: <T>(_o: string, fn: () => T) => fn(), billedUsdInScope: () => null }));
vi.mock('$lib/server/media-generate.images', () => ({
  renderPostImage: async () => {
    throw new CreditsExhaustedError({ quota: 0, used: 0, remaining: 0 } as never);
  },
  buildImageRequest: () => ({ model: null }),
  loadBrandVisualContext: async () => ({})
}));

describe('an image render that throws carries its cause, not a bare render_failed', () => {
  it('names exhausted credits instead of hiding them', async () => {
    const { generateImagesWithoutBrand } = await import('./media-generate');

    const out = await generateImagesWithoutBrand({} as never, { orgId: 'org-1', userId: 'user-1', prompt: 'a square' } as never);

    expect(out).toMatchObject({ ok: false, error: 'render_failed', reason: expect.stringMatching(/credits exhausted/) });
  });
});
