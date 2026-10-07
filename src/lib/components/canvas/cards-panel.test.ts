// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompositionNode } from '$lib/canvas/composition-node';
import CardsPanel from './CardsPanel.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const node: CompositionNode = {
  id: 'n1',
  layout: 'slider',
  layoutParams: {},
  camera: { preset: 'static', params: {} },
  background: { color: '#000000' },
  duration: 6,
  aspect: '9:16',
  refId: null,
  cells: {}
};

describe('the cards panel on a composition node', () => {
  let app: Record<string, unknown> | null = null;

  afterEach(() => {
    if (app) {
      unmount(app);
    }
    document.body.innerHTML = '';
  });

  it('sets one card ratio, leaving the others on the layout default', () => {
    const patches: unknown[] = [];
    app = mount(CardsPanel, { target: document.body, props: { node, cards: [{ sourceId: 'a', assetId: 'a1', kind: 'image' }, { sourceId: 'b', assetId: 'b1', kind: 'image' }], onpatch: (p: unknown) => patches.push(p) } });
    flushSync();

    const ratio = document.querySelector<HTMLSelectElement>('select[aria-label="Ratio of card 1"]')!;
    ratio.value = '4:5';
    ratio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(patches).toEqual([{ cells: { a: { aspect: '4:5' } } }]);
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Ratio of card 2"]')?.value).toBe('');
  });
});
