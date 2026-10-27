import { describe, expect, it } from 'vitest';
import { BrandHealth, BrandSection, brandHealth, brandSections, tallyBrandStatus, togglePin, type SwitcherBrand } from './brand-switcher';

const brand = (id: string, name: string, over: Partial<SwitcherBrand> = {}): SwitcherBrand => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  logoUrl: null,
  scheduled: 0,
  accounts: 0,
  accountsDown: 0,
  ...over
});

const acme = brand('a', 'Acme Coffee');
const nord = brand('n', 'Nord Bikes');
const bloom = brand('b', 'Bloom Studio');

describe('brandSections', () => {
  it('puts pinned first, then the project brand, then everything else A–Z', () => {
    const sections = brandSections([nord, bloom, acme], { query: '', pinned: ['n'], projectBrandId: 'a' });
    expect(sections.map((s) => [s.key, s.brands.map((b) => b.id)])).toEqual([
      [BrandSection.Pinned, ['n']],
      [BrandSection.Project, ['a']],
      [BrandSection.All, ['b']]
    ]);
  });

  it('shows a pinned project brand once, under pinned', () => {
    const sections = brandSections([acme, nord], { query: '', pinned: ['a'], projectBrandId: 'a' });
    expect(sections.map((s) => s.key)).toEqual([BrandSection.Pinned, BrandSection.All]);
  });

  it('filters every section by name or slug, ignoring case, and drops empty sections', () => {
    const sections = brandSections([acme, nord, bloom], { query: 'BIKE', pinned: ['a'], projectBrandId: null });
    expect(sections).toEqual([{ key: BrandSection.All, brands: [nord] }]);
  });

  it('ignores a pin for a brand that no longer exists', () => {
    const sections = brandSections([acme], { query: '', pinned: ['gone'], projectBrandId: null });
    expect(sections.map((s) => s.key)).toEqual([BrandSection.All]);
  });
});

describe('brandHealth', () => {
  it('an account to reconnect wins over anything scheduled', () => {
    expect(brandHealth(brand('x', 'X', { accounts: 2, accountsDown: 1, scheduled: 3 }))).toBe(BrandHealth.Reconnect);
  });

  it('scheduled posts with healthy accounts read as scheduled', () => {
    expect(brandHealth(brand('x', 'X', { accounts: 1, scheduled: 3 }))).toBe(BrandHealth.Scheduled);
  });

  it('no accounts at all reads as unconnected, connected with nothing planned as idle', () => {
    expect(brandHealth(brand('x', 'X'))).toBe(BrandHealth.Unconnected);
    expect(brandHealth(brand('x', 'X', { accounts: 1 }))).toBe(BrandHealth.Idle);
  });
});

describe('tallyBrandStatus', () => {
  it('counts upcoming ready posts and down accounts per brand', () => {
    const now = new Date('2026-10-27T12:00:00Z');
    const tally = tallyBrandStatus(
      {
        posts: [
          { brand_id: 'a', status: 'ready', planned_for: '2026-10-28T09:00:00Z' },
          { brand_id: 'a', status: 'ready', planned_for: '2026-10-20T09:00:00Z' },
          { brand_id: 'a', status: 'draft', planned_for: '2026-10-29T09:00:00Z' },
          { brand_id: 'a', status: 'ready', planned_for: null }
        ],
        accounts: [
          { brand_id: 'a', status: 'connected' },
          { brand_id: 'a', status: 'expired' },
          { brand_id: 'n', status: 'revoked' }
        ]
      },
      now
    );
    expect(tally.get('a')).toEqual({ scheduled: 1, accounts: 2, accountsDown: 1 });
    expect(tally.get('n')).toEqual({ scheduled: 0, accounts: 1, accountsDown: 1 });
  });
});

describe('togglePin', () => {
  it('adds a brand at the end and removes it on the second toggle', () => {
    expect(togglePin(['a'], 'n')).toEqual(['a', 'n']);
    expect(togglePin(['a', 'n'], 'a')).toEqual(['n']);
  });
});
