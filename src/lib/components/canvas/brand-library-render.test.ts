import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import BrandLibrary from './BrandLibrary.svelte';
import type { LibraryItem } from '$lib/canvas/brand-library';

const items: LibraryItem[] = [
  { id: 'p1', title: 'Launch', subtitle: null, assetId: 'a1', mediaType: 'image', group: 'Recent' },
  { id: 's1', title: 'Viral reel', subtitle: '900 interactions', assetId: 'a2', mediaType: 'video', group: 'Top social' },
  { id: 'x1', title: 'Text only', subtitle: null, assetId: null, mediaType: null, group: 'Top social' }
];

const body = (list: LibraryItem[]) => render(BrandLibrary, { props: { items: list, thumb: (id: string) => `/thumb/${id}`, empty: 'Nothing here.' } }).body;

describe('BrandLibrary', () => {
  it('groups items under their heading, once per group', () => {
    const html = body(items);
    expect(html.match(/Top social/g)?.length).toBe(1);
    expect(html.indexOf('Recent')).toBeLessThan(html.indexOf('Top social'));
  });

  it('every item is draggable and media shows its thumbnail', () => {
    const html = body(items);
    expect(html.match(/draggable="true"/g)?.length).toBe(3);
    expect(html).toContain('src="/thumb/a1"');
  });

  it('shows the empty text when there is nothing', () => {
    expect(body([])).toContain('Nothing here.');
  });
});
