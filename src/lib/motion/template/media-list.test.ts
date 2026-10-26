import { describe, expect, it } from 'vitest';
import { MEDIA_LIST } from './media-list';

const readList = (raw: unknown, assets: Record<string, string>) =>
  new Function('assets', 'fps', `${MEDIA_LIST}; return mediaList(arguments[2]);`)(assets, 30, raw);

describe('mediaList', () => {
  it('resolves a card array by assetId, as the media_list field stores it', () => {
    const cards = [{ kind: 'image', assetId: 'a1' }, { kind: 'video', assetId: 'v1' }];

    expect(readList(cards, { a1: 'https://x/a1.png', v1: 'https://x/v1.mp4' })).toEqual([
      { src: 'https://x/a1.png', video: false },
      { src: 'https://x/v1.mp4', video: true }
    ]);
  });

  it('drops a card whose asset is not registered', () => {
    expect(readList([{ kind: 'image', assetId: 'missing' }], {})).toEqual([]);
  });
});
