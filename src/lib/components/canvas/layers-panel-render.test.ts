import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LayersPanel from './LayersPanel.svelte';
import { layersSource } from '$lib/canvas/layers-source.svelte';
import { LayerKind } from '$lib/canvas/layers';
import type { OutlineCache } from '$lib/canvas/frame-outlines';

const POSTER = '/p/x/c/y/assets/a1';

const canvasWith = (nodes: { id: string; type: string; name: string | null; poster?: string | null; still?: boolean; head?: number }[], outlines: OutlineCache = {}) =>
  layersSource.publishCanvas({ nodes, selected: [], outlinesUrl: '', outlines, previewUrl: () => '', select: () => {}, open: () => {} });

let unpublish = () => {};

afterEach(() => unpublish());

describe('a frame row in Layers', () => {
  it('shows the stored poster as a lazy thumbnail', () => {
    unpublish = canvasWith([{ id: 'm1', type: 'motion', name: 'Teaser', poster: POSTER }]);
    const body = render(LayersPanel).body;

    expect(body).toContain(`src="${POSTER}"`);
    expect(body).toContain('loading="lazy"');
  });

  it('draws no empty placeholder thumbnail when nothing was stored', () => {
    unpublish = canvasWith([{ id: 'm1', type: 'motion', name: 'Teaser', poster: null }]);

    expect(render(LayersPanel).body).not.toContain('data-testid="layer-thumb"');
  });

  it('shows the elements the canvas load already outlined, before any fetch', () => {
    const title = { id: 't1', key: 't1', kind: LayerKind.Clip, depth: 2, label: 'Title', type: 'Title', nodeId: 'm1', hidden: false, locked: false, nested: false };
    unpublish = canvasWith([{ id: 'm1', type: 'motion', name: 'Teaser', head: 3 }], { 'm1:3': [title] });

    expect(render(LayersPanel).body).toContain('data-layer="t1"');
  });
});

describe('a long Layers list', () => {
  it('renders a window of rows, not every one of 500', () => {
    unpublish = canvasWith(Array.from({ length: 500 }, (_, i) => ({ id: `n${i}`, type: 'image', name: `Image ${i}` })));
    const rows = render(LayersPanel).body.match(/role="treeitem"/g) ?? [];

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
  });
});
