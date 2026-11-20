export type Rgba = { r: number; g: number; b: number; a: number };
export type Hsv = { h: number; s: number; v: number };

export enum ColourFormat {
  Hex = 'HEX',
  Rgb = 'RGB',
  Hsl = 'HSL',
  Oklch = 'OKLCH'
}

const RGB = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i;
const HEX = /^#([0-9a-f]{3,8})$/i;
const ALPHA_DECIMALS = 3;
const FULL = 255;

const byte = (n: number) => Math.round(Math.min(FULL, Math.max(0, n))).toString(16).padStart(2, '0');

export function parseRgba(css: string): Rgba | null {
  const text = css.trim();
  const hex = text.match(HEX)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? Number((n(6) / FULL).toFixed(ALPHA_DECIMALS)) : 1 };
  }
  const m = text.match(RGB);
  if (!m) {
    return null;
  }
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
}

export const rgbToHex = ({ r, g, b }: Pick<Rgba, 'r' | 'g' | 'b'>) => `#${byte(r)}${byte(g)}${byte(b)}`;

export const rgbaCss = (c: Rgba) => (c.a >= 1 ? rgbToHex(c) : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Number(c.a.toFixed(ALPHA_DECIMALS))})`);

export function hexToHsv(hex: string): Hsv {
  const c = parseRgba(hex) ?? { r: 0, g: 0, b: 0, a: 1 };
  const [r, g, b] = [c.r / FULL, c.g / FULL, c.b / FULL];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Pick<Rgba, 'r' | 'g' | 'b'> {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5) * FULL, g: f(3) * FULL, b: f(1) * FULL };
}

export const hsvToHex = (hsv: Hsv) => rgbToHex(hsvToRgb(hsv));

function hsl({ r, g, b }: Rgba): [number, number, number] {
  const [rr, gg, bb] = [r / FULL, g / FULL, b / FULL];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(hexToHsv(rgbToHex({ r, g, b })).h), Math.round(s * 100), Math.round(l * 100)];
}

const linear = (c: number) => {
  const x = c / FULL;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

function oklch({ r, g, b }: Rgba): [number, number, number] {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

const FORMATS: Record<ColourFormat, (c: Rgba) => string> = {
  [ColourFormat.Hex]: (c) => rgbToHex(c).toUpperCase(),
  [ColourFormat.Rgb]: (c) => `${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}`,
  [ColourFormat.Hsl]: (c) => {
    const [h, s, l] = hsl(c);
    return `${h}, ${s}%, ${l}%`;
  },
  [ColourFormat.Oklch]: (c) => {
    const [l, ch, h] = oklch(c);
    return `${l.toFixed(3)} ${ch.toFixed(3)} ${h.toFixed(1)}`;
  }
};

export const formatColour = (c: Rgba, format: ColourFormat) => FORMATS[format](c);
