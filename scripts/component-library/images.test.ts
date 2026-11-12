import { describe, expect, it } from 'vitest';
import { durableImages, showsImagePlaceholder } from './images';

const BASE = 'https://raw.githubusercontent.com/ruixenui/ruixen.com/f6b2086/public/';

describe('the images a shipped component keeps', () => {
  it('keeps a remote image at its address', () => {
    expect(durableImages({ a: 'https://images.unsplash.com/photo-1?w=800' }, BASE)).toEqual({ a: 'https://images.unsplash.com/photo-1?w=800' });
  });

  it('moves an image the local library served to the published source of the library', () => {
    expect(durableImages({ a: 'http://127.0.0.1:5391/logos/gong.svg' }, BASE)).toEqual({ a: `${BASE}logos/gong.svg` });
  });

  it('drops a local image when the library publishes none', () => {
    expect(durableImages({ a: 'http://localhost:5391/logos/gong.svg' }, undefined)).toEqual({});
  });

  it('keeps a small inline image and drops a large or unaddressable one', () => {
    const large = `data:image/png;base64,${'A'.repeat(70_000)}`;
    expect(durableImages({ a: 'data:image/png;base64,AAAA', b: 'blob:x', c: large }, BASE)).toEqual({ a: 'data:image/png;base64,AAAA' });
  });
});


describe('a component that would insert a grey image box', () => {
  const docWith = (fills: unknown[]) => ({ tracks: [], comps: { c: { tracks: [{ clips: [{ props: { fills } }] }] } } });

  it('is one with an image fill left as the import placeholder', () => {
    expect(showsImagePlaceholder(docWith([{ type: 'solid', color: '#d9d9d9', opacity: 1 }]))).toBe(true);
  });

  it('is not one whose image fills are filled', () => {
    expect(showsImagePlaceholder(docWith([{ type: 'image', assetId: 'https://x/y.png' }]))).toBe(false);
  });
});
