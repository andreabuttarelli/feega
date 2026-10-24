import { beforeEach, describe, expect, it, vi } from 'vitest';

const { llmText, findAsset, signMediaPaths } = vi.hoisted(() => ({
  llmText: vi.fn(),
  findAsset: vi.fn(),
  signMediaPaths: vi.fn()
}));

vi.mock('$lib/server/llm', () => ({ llmText }));
vi.mock('$lib/server/repos/assets', () => ({ findAsset }));
vi.mock('$lib/server/canvas/sign-media', () => ({ signMediaPaths }));

import { detectLayers } from './layer-detect';

const db = {} as never;
const SCOPE = { orgId: 'org', assetId: 'a1' };

beforeEach(() => {
  llmText.mockReset();
  findAsset.mockReset().mockResolvedValue({ id: 'a1', type: 'image', url: 'org/p/pic.png' });
  signMediaPaths.mockReset().mockResolvedValue(['https://signed.test/pic.png']);
});

describe('detectLayers', () => {
  it('shows the signed image to a vision model and reads the boxes it answers with', async () => {
    llmText.mockResolvedValue({ text: '[{"label":"mug","bbox":[100,100,600,800]}]', citations: [] });

    const layers = await detectLayers(db, SCOPE);

    expect(layers).toEqual([{ label: 'mug', box: { left: 0.1, top: 0.1, width: 0.5, height: 0.7 } }]);
    expect(llmText).toHaveBeenCalledWith(expect.objectContaining({ upstream: { imageUrls: ['https://signed.test/pic.png'] }, label: 'canvas.layers' }));
  });

  it('finds nothing in an asset that is not an image, without calling the model', async () => {
    findAsset.mockResolvedValue({ id: 'a1', type: 'video', url: 'org/p/clip.mp4' });

    expect(await detectLayers(db, SCOPE)).toEqual([]);
    expect(llmText).not.toHaveBeenCalled();
  });

  it('finds nothing when the model fails or answers with no boxes', async () => {
    llmText.mockRejectedValueOnce(new Error('upstream down'));
    expect(await detectLayers(db, SCOPE)).toEqual([]);

    llmText.mockResolvedValueOnce({ text: 'nothing separable here', citations: [] });
    expect(await detectLayers(db, SCOPE)).toEqual([]);
  });
});
