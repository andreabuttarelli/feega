// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CompositionNode, UpstreamCard } from '$lib/canvas/composition-node';
import { nodeDoc } from './composition-draft';

const plain: CompositionNode = {
  id: 'n1',
  layout: 'ring',
  layoutParams: { count: 6, tiltX: -20 },
  camera: { preset: 'static', params: {} },
  background: { color: '#112233' },
  duration: 8,
  aspect: '16:9',
  refId: null,
  cells: { img: { background: '#ff0000' } }
};

describe('a composition read straight from reactive canvas state', () => {
  it('builds its doc when node and cards are $state proxies', () => {
    const node = $state(plain);
    const cards = $state<UpstreamCard[]>([{ sourceId: 'img', assetId: 'a1', kind: 'image' }]);

    expect(() => nodeDoc(node, cards)).not.toThrow();
  });
});
