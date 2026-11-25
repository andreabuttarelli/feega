import { colourOf } from '@feega/live-edit/token-colour';
import type { Palette } from '../messages';

type Token = Palette['tokens'][number];

const THEME_PREFIX = '--color-';
const CHANNELS = [1, 3, 5];
const HEX_RADIX = 16;
const OPAQUE_SUFFIX = 'ff';

const rgbOf = (hex: string) => CHANNELS.map((at) => parseInt(hex.slice(at, at + 2), HEX_RADIX));

const distance = (a: string, b: string) => rgbOf(a).reduce((sum, channel, i) => sum + (channel - rgbOf(b)[i]) ** 2, 0);

const opaque = (hex: string) => (hex.length === 9 && hex.endsWith(OPAQUE_SUFFIX) ? hex.slice(0, 7) : hex);

export function colourCheck(value: string, tokens: Token[]): { off: boolean; nearest: Token | null } {
  const hex = colourOf(value);
  const known = tokens.flatMap((token) => {
    const own = colourOf(token.value);
    return own ? [{ token, hex: opaque(own) }] : [];
  });
  if (!hex || !known.length) {
    return { off: false, nearest: null };
  }
  const nearest = known.reduce((best, entry) => (distance(entry.hex, hex) < distance(best.hex, hex) ? entry : best));
  return { off: nearest.hex !== opaque(hex), nearest: nearest.token };
}

export const tokenPick = (name: string) => ({ css: `var(${name})`, token: name.startsWith(THEME_PREFIX) ? name.slice(THEME_PREFIX.length) : `[var(${name})]` });
