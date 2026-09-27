import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderPostImage = vi.fn();
const insertBrandMedia = vi.fn();
const storeBrandMediaBytes = vi.fn();
const signKnowledgePaths = vi.fn();
const withBrandContext = vi.fn();
const withOrgContext = vi.fn();
const loadBrandVisualContext = vi.fn();

const PNG_DATA_URL = 'data:image/png;base64,AAAA';

let billedUsd: number | undefined;

const imagePartFor = vi.fn();
vi.mock('$lib/server/brand-context', () => ({ imagePartFor: (url: string) => imagePartFor(url) }));
vi.mock('$lib/server/media-generate.images', () => ({
  renderPostImage: (...args: unknown[]) => renderPostImage(...args),
  buildImageRequest: (_prompt: string, opts: { model?: string }) => ({ model: opts.model ?? null }),
  loadBrandVisualContext: (...args: unknown[]) => loadBrandVisualContext(...args)
}));
vi.mock('$lib/server/brand-media', () => ({
  loadLibraryMediaPart: async () => ({ ok: false, reason: 'fetch_failed' }),
  insertBrandMedia: (...args: unknown[]) => insertBrandMedia(...args),
  storeBrandMediaBytes: (...args: unknown[]) => storeBrandMediaBytes(...args),
  probeImageDimensions: async () => ({ width: 1080, height: 1080 })
}));
vi.mock('$lib/server/media-archive', () => ({
  signKnowledgePaths: (...args: unknown[]) => signKnowledgePaths(...args)
}));
vi.mock('$lib/server/content-credentials', () => ({
  markImage: async (bytes: Buffer) => bytes,
  DIGITAL_SOURCE_TYPE: { synthetic: 'trainedAlgorithmicMedia' }
}));
vi.mock('$lib/server/ai-log', () => ({
  billedUsdInScope: () => billedUsd,
  withBrandContext: <T>(brandId: string, fn: () => T) => {
    withBrandContext(brandId);
    return fn();
  },
  withOrgContext: <T>(orgId: string, fn: () => T) => {
    withOrgContext(orgId);
    return fn();
  }
}));

import { generateImagesWithoutBrand } from './media-generate';

beforeEach(() => {
  vi.clearAllMocks();
  billedUsd = 0.01;
  renderPostImage.mockResolvedValue(PNG_DATA_URL);
  storeBrandMediaBytes.mockResolvedValue({});
  signKnowledgePaths.mockImplementation(async (_c: unknown, paths: string[]) => new Map(paths.map((p) => [p, 'https://signed'])));
});

describe('riferimenti scelti sul nodo, verso il renderer', () => {
  it('ogni url leggibile diventa un allegato di riferimento, non la base da modificare', async () => {
    imagePartFor.mockImplementation(async (url: string) =>
      url.includes('broken') ? { ok: false, reason: 'fetch_failed' } : { ok: true, part: { inlineData: { data: url, mimeType: 'image/png' } } }
    );
    const supabase = { storage: { from: () => ({ upload: async () => ({ error: null }) }) } } as never;

    await generateImagesWithoutBrand(supabase, {
      orgId: 'org-1',
      userId: 'user-1',
      prompt: 'un vaso',
      referenceImageUrls: ['https://cat/a.png', 'https://cat/broken.png']
    });

    const opts = renderPostImage.mock.calls[0][1] as { userRefImages?: unknown[]; baseImage?: unknown };
    expect(opts.userRefImages).toEqual([{ inlineData: { data: 'https://cat/a.png', mimeType: 'image/png' } }]);
    expect(opts.baseImage).toBeUndefined();
  });
});
