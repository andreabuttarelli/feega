import { describe, expect, it } from 'vitest';
import { BuiltinFont, FontCategory, FontSource, type FontFace } from './model';
import { outlineUrl } from './outline';

const google: FontFace = { family: 'Playfair Display', source: FontSource.Google, category: FontCategory.Serif, weights: [400, 700], axes: [] } as unknown as FontFace;
const upload: FontFace = { family: 'Acme Sans', source: FontSource.Upload, category: FontCategory.Sans, weights: [400], axes: [], assetId: 'font-1' } as unknown as FontFace;

describe('outlineUrl', () => {
  it('a Google family resolves to its woff on the font CDN at the nearest loaded weight', () => {
    expect(outlineUrl('Playfair Display', 800, [google], {})).toBe('https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.woff');
  });

  it('a built-in resolves like a Google family', () => {
    expect(outlineUrl(BuiltinFont.Sans, 500, [], {})).toMatch(/fonts\/dm-sans@latest\/latin-500-normal\.woff$/);
  });

  it('an uploaded family resolves to its own file, or nothing when the asset is gone', () => {
    expect(outlineUrl('Acme Sans', 700, [upload], { 'font-1': 'https://x/acme.ttf' })).toBe('https://x/acme.ttf');
    expect(outlineUrl('Acme Sans', 700, [upload], {})).toBeNull();
  });
});
