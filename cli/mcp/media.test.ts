import { describe, expect, test } from 'bun:test';
import type { Media } from '../lib/api.ts';
import { mediaView, generationView } from './media.ts';

const image = {
  assetId: 'a1', nodeId: 'n1', runId: null, type: 'image', mimeType: 'image/png', width: 1366, height: 2048,
  durationS: null, bytes: 4_000_000, fullUrl: 'https://s/full.png', previewUrl: 'https://s/full.png?width=1024', text: null
};

describe('get_media gives the agent a link to look at and one to hand over', () => {
  test('an image carries a 1024px preview link and the full-size link, never inline bytes', () => {
    const view = mediaView({ items: [image], missing: ['gone'] });

    expect(view.items).toEqual([expect.objectContaining({
      asset_id: 'a1', type: 'image', mime_type: 'image/png', width: 1366, height: 2048,
      preview_url: 'https://s/full.png?width=1024', full_url: 'https://s/full.png'
    })]);
    expect(view.missing).toEqual(['gone']);
    expect(JSON.stringify(view)).not.toContain('base64');
  });
});

describe('run_node_generation names what it produced', () => {
  test('a finished image carries its asset id and both links', async () => {
    const outcome = { kind: 'done', run: { id: 'r1', outputAssetId: 'a1' }, asset: { id: 'a1', type: 'image' } };

    const view = await generationView(outcome, async (ids) => {
      expect(ids).toEqual(['a1']);
      return { items: [image], missing: [] } as Media;
    });

    expect(view).toMatchObject({ kind: 'done', asset_ids: ['a1'] });
    expect(view.media).toEqual([expect.objectContaining({ preview_url: image.previewUrl, full_url: image.fullUrl })]);
  });

  test('a queued video has no asset yet and asks for nothing', async () => {
    let asked = false;
    const view = await generationView({ kind: 'queued', run: { id: 'r1' } }, async () => {
      asked = true;
      return { items: [], missing: [] };
    });

    expect(asked).toBe(false);
    expect(view).toMatchObject({ kind: 'queued', asset_ids: [], media: [] });
  });
});
