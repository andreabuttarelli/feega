import { BlendMode } from '../blend';
import type { Rgba } from './rgba';

type Rgb = [number, number, number];

const HALF = 0.5;
const QUARTER = 0.25;
const LUMA: Rgb = [0.3, 0.59, 0.11];

const separable = (f: (b: number, s: number) => number) => (b: Rgb, s: Rgb): Rgb => [f(b[0], s[0]), f(b[1], s[1]), f(b[2], s[2])];

const hardLight = (b: number, s: number) => (s <= HALF ? b * 2 * s : b + (2 * s - 1) - b * (2 * s - 1));
const softLightD = (b: number) => (b <= QUARTER ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b));

const lum = (c: Rgb) => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
const sat = (c: Rgb) => Math.max(...c) - Math.min(...c);

function clipColour(c: Rgb): Rgb {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  const low = n < 0 ? c.map((v) => l + ((v - l) * l) / (l - n)) : c;
  return (x > 1 ? low.map((v) => l + ((v - l) * (1 - l)) / (x - l)) : low) as Rgb;
}

const withLum = (c: Rgb, l: number): Rgb => clipColour(c.map((v) => v + l - lum(c)) as Rgb);

function withSat(c: Rgb, s: number): Rgb {
  const max = Math.max(...c);
  const min = Math.min(...c);
  return c.map((v) => (max === min ? 0 : v === max ? s : v === min ? 0 : ((v - min) * s) / (max - min))) as Rgb;
}

const BLENDS: Record<BlendMode, (b: Rgb, s: Rgb) => Rgb> = {
  [BlendMode.Normal]: (_b, s) => s,
  [BlendMode.Multiply]: separable((b, s) => b * s),
  [BlendMode.Screen]: separable((b, s) => b + s - b * s),
  [BlendMode.Overlay]: separable((b, s) => hardLight(s, b)),
  [BlendMode.Darken]: separable(Math.min),
  [BlendMode.Lighten]: separable(Math.max),
  [BlendMode.ColorDodge]: separable((b, s) => (b === 0 ? 0 : s === 1 ? 1 : Math.min(1, b / (1 - s)))),
  [BlendMode.ColorBurn]: separable((b, s) => (b === 1 ? 1 : s === 0 ? 0 : 1 - Math.min(1, (1 - b) / s))),
  [BlendMode.HardLight]: separable(hardLight),
  [BlendMode.SoftLight]: separable((b, s) => (s <= HALF ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (softLightD(b) - b))),
  [BlendMode.Difference]: separable((b, s) => Math.abs(b - s)),
  [BlendMode.Exclusion]: separable((b, s) => b + s - 2 * b * s),
  [BlendMode.Hue]: (b, s) => withLum(withSat(s, sat(b)), lum(b)),
  [BlendMode.Saturation]: (b, s) => withLum(withSat(b, sat(s)), lum(b)),
  [BlendMode.Color]: (b, s) => withLum(s, lum(b)),
  [BlendMode.Luminosity]: (b, s) => withLum(b, lum(s))
};

export function blended(backdrop: Rgba, source: Rgba, mode: BlendMode): Rgba {
  const [b, s] = [backdrop.slice(0, 3) as Rgb, source.slice(0, 3) as Rgb];
  const mixed = BLENDS[mode](b, s);
  const own = s.map((v, i) => (1 - backdrop[3]) * v + backdrop[3] * mixed[i]);
  const alpha = source[3] + backdrop[3] * (1 - source[3]);
  const channel = (i: number) => (alpha === 0 ? 0 : (source[3] * own[i] + backdrop[3] * b[i] * (1 - source[3])) / alpha);
  return [channel(0), channel(1), channel(2), alpha];
}
