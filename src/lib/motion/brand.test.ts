import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS, brandTokens, paletteFrom, resolveColor } from './brand';

describe('brand tokens', () => {
  it('a brand colour resolves to the brand palette', () => {
    const tokens = brandTokens({ name: 'Acme', palette: ['#112233', '#445566', '#778899'], logoUrl: null });

    expect(resolveColor('brand.accent', tokens)).toBe('#778899');
  });

  it('a custom colour stays as written', () => {
    expect(resolveColor('#abcdef', FEEGA_TOKENS)).toBe('#abcdef');
  });

  it('without a palette the feega look is used', () => {
    expect(brandTokens({ name: 'x', palette: null, logoUrl: null }).colors).toEqual(FEEGA_TOKENS.colors);
  });

  it('reads the palette from the hex codes written in the brand profile', () => {
    expect(paletteFrom('Primary #FF0000, accent #00ff00, again #FF0000')).toEqual(['#FF0000', '#00ff00']);
  });
});
