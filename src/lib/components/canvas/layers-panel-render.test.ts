import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LayersPanel from './LayersPanel.svelte';
import { layersSource } from '$lib/canvas/layers-source.svelte';

const POSTER = '/p/x/c/y/assets/a1';

const canvasWith = (nodes: { id: string; type: string; name: string | null; poster?: string | null; still?: boolean }[]) =>
  layersSource.publishCanvas({ nodes, selected: [], outlinesUrl: '', previewUrl: () => '', select: () => {} });

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
});
