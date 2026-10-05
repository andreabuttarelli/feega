import { describe, expect, it } from 'vitest';
import { cardAssetIds, staleMotions, upstreamCards, upstreamImageRefs, upstreamMedia } from './composition-node';

describe('upstreamImageRefs', () => {
  it('collects refIds from several image nodes wired in', () => {
    const edges = [
      { source: 'img1', target: 'comp' },
      { source: 'img2', target: 'comp' }
    ];
    const nodes = [
      { id: 'img1', data: { refId: 'a1' } },
      { id: 'img2', data: { assetId: 'a2' } }
    ];
    expect(upstreamImageRefs('comp', edges, nodes)).toEqual(['a1', 'a2']);
  });

  it('expands a connected list node into its image items', () => {
    const edges = [{ source: 'list1', target: 'comp' }];
    const nodes = [
      {
        id: 'list1',
        data: { items: [{ asset_id: 'a1' }, { asset_id: 'a2' }, { text: 'no image here' }] }
      }
    ];
    expect(upstreamImageRefs('comp', edges, nodes)).toEqual(['a1', 'a2']);
  });

  it('is empty when nothing feeds the node', () => {
    expect(upstreamImageRefs('comp', [], [{ id: 'img1', data: { refId: 'a1' } }])).toEqual([]);
    expect(upstreamImageRefs('comp', [{ source: 'img1', target: 'comp' }], [{ id: 'img1', data: {} }])).toEqual([]);
  });
});

describe('upstreamMedia', () => {
  it('names each wired picture or clip with its kind, so the motion engine plays videos as videos', () => {
    const edges = [
      { source: 'img', target: 'comp' },
      { source: 'vid', target: 'comp' }
    ];
    const nodes = [
      { id: 'img', type: 'image', data: { refId: 'a1' } },
      { id: 'vid', type: 'video', data: { refId: 'v1' } }
    ];

    expect(upstreamMedia('comp', edges, nodes)).toEqual([
      { assetId: 'a1', kind: 'image' },
      { assetId: 'v1', kind: 'video' }
    ]);
  });
});

describe('upstreamCards', () => {
  const MOTION = { id: 'mot', type: 'motion', data: { format: 'landscape', docHeadRevision: 4, posterAssetId: 'poster-1', lastRenderAssetId: null } };

  it('a wired motion editor is a card of its own, named by its node and revision, in wiring order', () => {
    const edges = [
      { source: 'img', target: 'comp' },
      { source: 'mot', target: 'comp' }
    ];
    const nodes = [{ id: 'img', type: 'image', data: { refId: 'a1' } }, MOTION];

    expect(upstreamCards('comp', edges, nodes)).toEqual([
      { sourceId: 'img', kind: 'image', assetId: 'a1' },
      { sourceId: 'mot', kind: 'motion', revision: 4, posterAssetId: 'poster-1' }
    ]);
  });

  it('leaves out a motion the composition itself feeds: composition, motion, composition never loops', () => {
    const edges = [
      { source: 'mot', target: 'comp' },
      { source: 'comp', target: 'mot' }
    ];

    expect(upstreamCards('comp', edges, [MOTION])).toEqual([]);
  });

  it('upstreamMedia keeps to pictures and clips', () => {
    expect(upstreamMedia('comp', [{ source: 'mot', target: 'comp' }], [MOTION])).toEqual([]);
  });
});

describe('staleMotions: which motion editors the preview must (re)load', () => {
  const card = (sourceId: string, revision: number) => ({ sourceId, kind: 'motion' as const, revision, posterAssetId: null });

  it('a motion never read, or saved again since, is reloaded; one at the same revision is not', () => {
    const cards = [card('a', 1), card('b', 4), card('c', 2), { sourceId: 'img', kind: 'image' as const, assetId: 'x' }];

    expect(staleMotions(cards, { b: 4, c: 1 }).map((c) => c.sourceId)).toEqual(['a', 'c']);
  });
});

it('cardAssetIds names every picture the preview may show: media and the posters a motion falls back to', () => {
  const cards = [
    { sourceId: 'i', kind: 'image' as const, assetId: 'a1' },
    { sourceId: 'm', kind: 'motion' as const, revision: 1, posterAssetId: 'p1' },
    { sourceId: 'n', kind: 'motion' as const, revision: 1, posterAssetId: null }
  ];

  expect(cardAssetIds(cards)).toEqual(['a1', 'p1']);
});
