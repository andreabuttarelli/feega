import type { BrandColor } from './components';

export type BrandTokens = {
  name: string;
  colors: Record<BrandColor, string>;
  logoUrl: string | null;
};

export const FEEGA_TOKENS: BrandTokens = {
  name: 'feega',
  colors: {
    'brand.primary': '#f0eee9',
    'brand.secondary': '#8a8a8a',
    'brand.accent': '#0099ff',
    'brand.background': '#0a0a0a',
    'brand.text': '#f0eee9'
  },
  logoUrl: null
};

const HEX = /^#[0-9a-fA-F]{6}$/;

const PALETTE_ORDER: readonly BrandColor[] = ['brand.primary', 'brand.secondary', 'brand.accent'];

export function resolveColor(value: unknown, tokens: BrandTokens): string {
  if (typeof value !== 'string') {
    return tokens.colors['brand.text'];
  }
  if (value in tokens.colors) {
    return tokens.colors[value as BrandColor];
  }
  return value;
}

const HEX_IN_TEXT = /#[0-9a-fA-F]{6}\b/g;

export function paletteFrom(content: string | null): string[] {
  return [...new Set((content ?? '').match(HEX_IN_TEXT) ?? [])];
}

export function brandTokens(input: { name: string; palette: unknown; logoUrl: string | null }): BrandTokens {
  const hexes = (Array.isArray(input.palette) ? input.palette : []).filter((c): c is string => typeof c === 'string' && HEX.test(c));
  const colors = { ...FEEGA_TOKENS.colors };
  PALETTE_ORDER.forEach((key, i) => {
    if (hexes[i]) {
      colors[key] = hexes[i];
    }
  });
  return { name: input.name, colors, logoUrl: input.logoUrl };
}
