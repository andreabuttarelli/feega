import { describe, expect, it, vi } from 'vitest';
import type { BrandProfile } from '$lib/server/brand-analysis';
import { BrandFromSite, brandFromSite, kitFromProfile, type BrandSitePorts, type SiteKit } from './brand-from-site';

const SCOPE = { orgId: 'o1', projectId: 'p1', canvasId: 'c1' };
const URL_IN = 'https://www.stripe.com/';

const PROFILE = {
  name: 'Stripe',
  url: URL_IN,
  about: 'Payments infrastructure for the internet.',
  brand_style: 'Confident, precise, developer-friendly.',
  target_audience: 'Developers and finance teams',
  brand_colors: ['#635BFF', '#0A2540', 'blue', '#00D4FF'],
  logos: [{ url: 'https://stripe.com/logo.svg', type: 'svg' }],
  fonts: [{ name: 'Sohne', source: 'css' }, { name: 'Inter', source: 'google' }],
  social_handles: [{ platform: 'instagram', handle: 'stripe', url: 'https://instagram.com/stripe' }],
  category: 'Fintech',
  products: []
} as unknown as BrandProfile;

const KIT: SiteKit = kitFromProfile(PROFILE, URL_IN);

function ports(over: Partial<BrandSitePorts> = {}): BrandSitePorts {
  return {
    findByDomain: vi.fn(async () => null),
    analyse: vi.fn(async () => PROFILE),
    createBrand: vi.fn(async () => 'b-new'),
    attach: vi.fn(async () => undefined),
    placeKit: vi.fn(async () => 'kit-frame'),
    ...over
  };
}

describe('the brand read from the site becomes a brand row', () => {
  it('keeps name, palette, fonts, logo, voice and description', () => {
    expect(KIT).toEqual({
      name: 'Stripe',
      website: URL_IN,
      shortDescription: 'Payments infrastructure for the internet.',
      palette: [{ hex: '#635BFF' }, { hex: '#0A2540' }, { hex: '#00D4FF' }],
      fonts: ['Sohne', 'Inter'],
      logoUrl: 'https://stripe.com/logo.svg',
      voice: { tone: 'Confident, precise, developer-friendly.' },
      content: expect.stringContaining('## Target')
    });
  });

  it('a new site is analysed, saved, attached to the project and drawn next to the page', async () => {
    const p = ports();

    const done = await brandFromSite(SCOPE, URL_IN, { x: 1600, y: 0 }, p);

    expect(done).toEqual({ outcome: BrandFromSite.Created, brandId: 'b-new', frameId: 'kit-frame' });
    expect(p.findByDomain).toHaveBeenCalledWith('o1', 'stripe.com');
    expect(p.createBrand).toHaveBeenCalledWith('o1', KIT);
    expect(p.attach).toHaveBeenCalledWith('o1', 'p1', 'b-new');
    expect(p.placeKit).toHaveBeenCalledWith(SCOPE, KIT, { x: 1600, y: 0 });
  });

  it('a brand already in the org for that domain is reused, without spending on analysis', async () => {
    const p = ports({ findByDomain: vi.fn(async () => ({ id: 'b-old', kit: KIT })) });

    const done = await brandFromSite(SCOPE, URL_IN, { x: 0, y: 0 }, p);

    expect(done).toMatchObject({ outcome: BrandFromSite.Reused, brandId: 'b-old' });
    expect(p.analyse).not.toHaveBeenCalled();
    expect(p.createBrand).not.toHaveBeenCalled();
    expect(p.attach).toHaveBeenCalledWith('o1', 'p1', 'b-old');
  });

  it('a failed analysis creates nothing and says so', async () => {
    const p = ports({ analyse: vi.fn(async () => { throw new Error('moderation_unavailable'); }) });

    const done = await brandFromSite(SCOPE, URL_IN, { x: 0, y: 0 }, p);

    expect(done).toEqual({ outcome: BrandFromSite.Failed, error: 'moderation_unavailable' });
    expect(p.createBrand).not.toHaveBeenCalled();
    expect(p.attach).not.toHaveBeenCalled();
  });

  it('a kit that cannot be drawn keeps the saved brand', async () => {
    const p = ports({ placeKit: vi.fn(async () => { throw new Error('store'); }) });

    const done = await brandFromSite(SCOPE, URL_IN, { x: 0, y: 0 }, p);

    expect(done).toEqual({ outcome: BrandFromSite.Created, brandId: 'b-new', frameId: null });
  });
});
