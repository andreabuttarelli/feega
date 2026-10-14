import { z } from 'zod';
import type { LayoutStore } from './editor-layout';

export const RECENT_MAX = 8;

const STORAGE_KEY = 'motion-recent-colours';
const TOKEN = /^brand\.(primary|secondary|accent|background|text)$/;
const LONG = /^#?([0-9a-f]{6})$/i;
const SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const TOKEN_PREFIX = 'brand.';

export function parseColour(text: string): string | null {
  const trimmed = text.trim();
  if (TOKEN.test(trimmed)) {
    return trimmed;
  }
  const long = LONG.exec(trimmed);
  if (long) {
    return `#${long[1].toLowerCase()}`;
  }
  const short = SHORT.exec(trimmed);
  return short ? `#${short.slice(1).map((c) => c + c).join('').toLowerCase()}` : null;
}

export function colourLabel(value: string): string {
  if (value.startsWith(TOKEN_PREFIX)) {
    return `Brand ${value.slice(TOKEN_PREFIX.length)}`;
  }
  return value.replace('#', '').toUpperCase();
}

const recentSchema = z.array(z.string().regex(LONG)).max(RECENT_MAX);

export function readRecent(store: LayoutStore | null): string[] {
  try {
    const parsed = recentSchema.safeParse(JSON.parse(store?.getItem(STORAGE_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function remember(recent: readonly string[], hex: string, store: LayoutStore | null): string[] {
  const next = [hex, ...recent.filter((c) => c !== hex)].slice(0, RECENT_MAX);
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export enum ColourFormat {
  Hex = 'hex',
  Rgb = 'rgb',
  Hsl = 'hsl'
}

export const COLOUR_FORMATS: readonly ColourFormat[] = [ColourFormat.Hex, ColourFormat.Rgb, ColourFormat.Hsl];

export type Channels = (number | string)[];

type Rgb = [number, number, number];

const BYTE = 255;
const TURN = 360;
const HUNDRED = 100;
const SIXTH = 60;
const HSL_PRECISION = 10;

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Number.isFinite(v) ? v : 0));
const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const hexOf = (rgb: Rgb) => `#${rgb.map((c) => Math.round(clamp(c, BYTE)).toString(16).padStart(2, '0')).join('')}`;
const tenth = (v: number) => Math.round(v * HSL_PRECISION) / HSL_PRECISION;

function hueOf(r: number, g: number, b: number, max: number, d: number): number {
  if (max === r) {
    return ((g - b) / d) % 6;
  }
  return max === g ? (b - r) / d + 2 : (r - g) / d + 4;
}

function hslOf([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / BYTE, g / BYTE, b / BYTE];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return [0, 0, tenth(l * HUNDRED)];
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = (hueOf(rr, gg, bb, max, d) * SIXTH + TURN) % TURN;
  return [tenth(h), tenth(s * HUNDRED), tenth(l * HUNDRED)];
}

function rgbFromHsl(h: number, s: number, l: number): Rgb {
  const [ss, ll] = [clamp(s, HUNDRED) / HUNDRED, clamp(l, HUNDRED) / HUNDRED];
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const hh = ((((Number.isFinite(h) ? h : 0) % TURN) + TURN) % TURN) / SIXTH;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = ll - c / 2;
  const sectors: Rgb[] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  return sectors[Math.floor(hh) % 6].map((v) => (v + m) * BYTE) as Rgb;
}

const TO_CHANNELS: Record<ColourFormat, (hex: string) => Channels> = {
  [ColourFormat.Hex]: (hex) => [hex.slice(1).toUpperCase()],
  [ColourFormat.Rgb]: (hex) => rgbOf(hex),
  [ColourFormat.Hsl]: (hex) => hslOf(rgbOf(hex))
};

function hexChannel(c: Channels): string | null {
  const parsed = parseColour(String(c[0] ?? ''));
  return parsed?.startsWith('#') ? parsed : null;
}

const FROM_CHANNELS: Record<ColourFormat, (c: Channels) => string | null> = {
  [ColourFormat.Hex]: hexChannel,
  [ColourFormat.Rgb]: (c) => hexOf(c.map(Number) as Rgb),
  [ColourFormat.Hsl]: (c) => hexOf(rgbFromHsl(Number(c[0]), Number(c[1]), Number(c[2])))
};

export const channelsOf = (hex: string, format: ColourFormat): Channels => TO_CHANNELS[format](hex);

export const fromChannels = (format: ColourFormat, channels: Channels): string | null => FROM_CHANNELS[format](channels);
