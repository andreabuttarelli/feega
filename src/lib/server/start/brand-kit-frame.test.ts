import { describe, expect, it } from 'vitest';
import { brandKitDoc, KIT_SIZE } from './brand-kit-frame';
import type { SiteKit } from './brand-from-site';

const KIT: SiteKit = { name: 'Stripe', website: 'https://stripe.com/', shortDescription: null, palette: [{ hex: '#635BFF' }, { hex: '#0A2540' }], fonts: ['Sohne'], logoUrl: null, voice: {}, content: '' };

type Clip = { component: string; props: Record<string, unknown> };
const clips = (doc: ReturnType<typeof brandKitDoc>) => doc.tracks[0].clips as unknown as Clip[];

describe('the brand kit is a frame the user sees next to the page', () => {
  it('one swatch per colour, labelled with its hex', () => {
    const all = clips(brandKitDoc(KIT, null));
    const fills = all.filter((c) => c.component === 'Shape').map((c) => (c.props.fills as { color: string }[])[0].color);
    expect(fills).toEqual(expect.arrayContaining(['#635BFF', '#0A2540']));
    expect(all.map((c) => c.props.text)).toEqual(expect.arrayContaining(['Stripe', '#635BFF', '#0A2540', 'Sohne']));
  });

  it('the logo goes in when it was imported, and only then', () => {
    expect(clips(brandKitDoc(KIT, 'asset-1')).find((c) => c.component === 'Image')?.props.assetId).toBe('asset-1');
    expect(clips(brandKitDoc(KIT, null)).some((c) => c.component === 'Image')).toBe(false);
  });

  it('is a fixed, small frame', () => {
    const doc = brandKitDoc(KIT, null);
    expect([doc.width, doc.height]).toEqual([KIT_SIZE.width, KIT_SIZE.height]);
  });
});
