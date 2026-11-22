import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogItem } from '../../../packages/library/src/catalog';
import { entriesOf, insertAskOf } from './library';

const item = (id: string, tier: 'free' | 'pro'): CatalogItem => ({
  id,
  name: id.toUpperCase(),
  description: `${id} item`,
  category: 'section',
  tags: ['t'],
  frameworks: ['html', 'svelte', 'react', 'vue', 'astro'],
  dependencies: [],
  fonts: [{ family: 'Inter Tight', weights: [400] }],
  tier,
  component: id[0].toUpperCase() + id.slice(1),
  files: { svelte: [{ name: 'A.svelte', text: 's' }], react: [], vue: [], astro: [] },
  page: '<html></html>'
});

const catalog: Catalog = { tokens: ':root{}', items: [item('pricing', 'free'), item('studio', 'pro')] };

describe('entriesOf', () => {
  it('lists what the panel shows and none of the file contents', () => {
    expect(entriesOf(catalog)).toEqual([
      { id: 'pricing', name: 'PRICING', description: 'pricing item', category: 'section', tags: ['t'], tier: 'free', page: '<html></html>' },
      { id: 'studio', name: 'STUDIO', description: 'studio item', category: 'section', tags: ['t'], tier: 'pro', page: '<html></html>' }
    ]);
  });
});

describe('insertAskOf', () => {
  it('hands the proposal what it writes and the tokens', () => {
    const out = insertAskOf(catalog, 'pricing');
    expect(out).toMatchObject({ ok: true, tokens: ':root{}', item: { id: 'pricing', component: 'Pricing', fonts: [{ family: 'Inter Tight', weights: [400] }] } });
  });

  it('hands a free item as it is, with its files', () => {
    expect(insertAskOf(catalog, 'pricing')).toMatchObject({ ok: true, pro: false, item: { files: { svelte: [{ name: 'A.svelte', text: 's' }] } } });
  });

  it('marks a pro item as one whose files come from the server, with none of its own', () => {
    const out = insertAskOf({ ...catalog, items: [{ ...item('studio', 'pro'), files: { svelte: [{ name: 'Leak.svelte', text: 'x' }], react: [], vue: [], astro: [] } }] }, 'studio');

    expect(out).toMatchObject({ ok: true, pro: true, tokens: ':root{}', item: { id: 'studio', component: 'Studio', files: { svelte: [], react: [], vue: [], astro: [] } } });
  });

  it('refuses an id the catalog does not hold', () => {
    expect(insertAskOf(catalog, 'nope')).toEqual({ ok: false, reason: 'no library item nope' });
    expect(insertAskOf(null, 'pricing')).toEqual({ ok: false, reason: 'the library is not available' });
  });
});
