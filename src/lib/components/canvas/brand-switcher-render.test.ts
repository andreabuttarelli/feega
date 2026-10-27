import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import BrandSwitcher from './BrandSwitcher.svelte';
import type { SwitcherBrand } from '$lib/canvas/brand-switcher';

const brand = (id: string, name: string, over: Partial<SwitcherBrand> = {}): SwitcherBrand => ({
  id,
  name,
  slug: name.toLowerCase(),
  logoUrl: null,
  scheduled: 0,
  accounts: 1,
  accountsDown: 0,
  ...over
});

const noop = () => {};

function body(props: { brands: SwitcherBrand[]; pinned?: string[]; projectBrandId?: string | null; query?: string }) {
  return render(BrandSwitcher, {
    props: { pinned: [], projectBrandId: null, query: '', newBrandHref: '/new', onpick: noop, onpin: noop, ...props }
  }).body;
}

describe('BrandSwitcher', () => {
  it('has a search field and a link to create a brand', () => {
    const html = body({ brands: [brand('a', 'Acme')] });
    expect(html).toContain('type="search"');
    expect(html).toContain('href="/new"');
  });

  it('labels the pinned and project sections', () => {
    const html = body({ brands: [brand('a', 'Acme'), brand('n', 'Nord'), brand('b', 'Bloom')], pinned: ['n'], projectBrandId: 'a' });
    expect(html.indexOf('Pinned')).toBeLessThan(html.indexOf('This project'));
    expect(html.indexOf('This project')).toBeLessThan(html.indexOf('All brands'));
  });

  it('shows a status for each brand', () => {
    const html = body({ brands: [brand('a', 'Acme', { scheduled: 3 }), brand('n', 'Nord', { accountsDown: 1 })] });
    expect(html).toContain('3 scheduled');
    expect(html).toContain('Reconnect');
    expect(html).toContain('data-health="reconnect"');
  });

  it('says so when the search matches nothing', () => {
    expect(body({ brands: [brand('a', 'Acme')], query: 'zzz' })).toContain('No brand matches');
  });
});
