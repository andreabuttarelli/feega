import { z } from 'zod';
import type { LayoutStore } from './editor-layout';

export const RECENT_MAX = 8;

const STORAGE_KEY = 'motion-recent-colours';
const TOKEN = /^brand\.(primary|secondary|accent|background|text)$/;
const LONG = /^#?([0-9a-f]{6})$/i;
const HEX_DIGITS = /^#?([0-9a-f]+)$/i;
const NUMBER = '(\\d+(?:\\.\\d+)?%?)';
const RGB = new RegExp(`^(?:rgba?\\(\\s*)?${NUMBER}[\\s,]+${NUMBER}[\\s,]+${NUMBER}(?:\\s*[\\s,/]\\s*${NUMBER})?\\s*\\)?$`, 'i');
const TOKEN_PREFIX = 'brand.';
const ALPHA_DIGITS = 1000;

export type TypedColour = { colour: string; alpha: number | null };

const SIX_DIGITS: Record<number, (d: string) => string> = {
  1: (d) => d.repeat(6),
  2: (d) => d.repeat(3),
  3: (d) => [...d].map((c) => c + c).join(''),
  4: (d) => [...d].map((c) => c + c).join(''),
  6: (d) => d,
  8: (d) => d
};

const roundAlpha = (a: number) => Math.round(a * ALPHA_DIGITS) / ALPHA_DIGITS;

function fromHex(digits: string): TypedColour | null {
  const expand = SIX_DIGITS[digits.length];
  if (!expand) {
    return null;
  }
  const full = expand(digits.toLowerCase());
  return { colour: `#${full.slice(0, 6)}`, alpha: full.length > 6 ? roundAlpha(parseInt(full.slice(6), 16) / BYTE) : null };
}

const byte = (text: string) => (text.endsWith('%') ? (parseFloat(text) / HUNDRED) * BYTE : parseFloat(text));
const unit = (text: string) => (text.endsWith('%') ? parseFloat(text) / HUNDRED : parseFloat(text));

function fromRgb([r, g, b, a]: string[]): TypedColour | null {
  const channels = [r, g, b].map(byte);
  const alpha = a === undefined ? null : unit(a);
  if (channels.some((c) => c > BYTE) || (alpha !== null && alpha > 1)) {
    return null;
  }
  return { colour: `#${channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`, alpha: alpha === null ? null : roundAlpha(alpha) };
}

const READERS: [RegExp, (groups: string[]) => TypedColour | null][] = [
  [TOKEN, ([token]) => ({ colour: token, alpha: null })],
  [HEX_DIGITS, ([, digits]) => fromHex(digits)],
  [RGB, ([, ...groups]) => fromRgb(groups)]
];

export function parseColour(text: string): TypedColour | null {
  const trimmed = text.trim();
  for (const [pattern, read] of READERS) {
    const match = pattern.exec(trimmed);
    if (match) {
      return read([...match]);
    }
  }
  return null;
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

export enum ColourDisplay {
  Field = 'field',
  Chip = 'chip'
}

export enum ColourFormat {
  Hex = 'hex',
  Rgb = 'rgb',
  Hsl = 'hsl',
  Hsb = 'hsb'
}

export const COLOUR_FORMATS: readonly ColourFormat[] = [ColourFormat.Hex, ColourFormat.Rgb, ColourFormat.Hsl, ColourFormat.Hsb];

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

export type Hsb = { h: number; s: number; b: number };

export function hsbOfHex(hex: string): Hsb {
  const [r, g, b] = rgbOf(hex).map((c) => c / BYTE);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) {
    return { h: 0, s: 0, b: max * HUNDRED };
  }
  const h = (hueOf(r, g, b, max, d) * SIXTH + TURN) % TURN;
  return { h, s: (d / max) * HUNDRED, b: max * HUNDRED };
}

export function hexOfHsb({ h, s, b }: Hsb): string {
  const v = clamp(b, HUNDRED) / HUNDRED;
  const l = v * (1 - clamp(s, HUNDRED) / HUNDRED / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return hexOf(rgbFromHsl(h, sl * HUNDRED, l * HUNDRED));
}

export function unitAt(offset: number, size: number): number {
  return size > 0 ? Math.min(1, Math.max(0, offset / size)) : 0;
}

export const percentOfAlpha = (alpha: number) => Math.round(alpha * HUNDRED);

export function alphaOfText(text: string): number | null {
  const n = Number(text.replace('%', ''));
  return text.trim() === '' || !Number.isFinite(n) ? null : clamp(n, HUNDRED) / HUNDRED;
}

export const snap = (value: number, step: number) => Math.round(value / step) * step;

export const nudge = (value: number, delta: number, max: number) => clamp(value + delta, max);

const TO_CHANNELS: Record<ColourFormat, (hex: string) => Channels> = {
  [ColourFormat.Hex]: (hex) => [hex.slice(1).toUpperCase()],
  [ColourFormat.Rgb]: (hex) => rgbOf(hex),
  [ColourFormat.Hsl]: (hex) => hslOf(rgbOf(hex)),
  [ColourFormat.Hsb]: (hex) => Object.values(hsbOfHex(hex)).map(Math.round)
};

function hexChannel(c: Channels): string | null {
  const parsed = parseColour(String(c[0] ?? ''))?.colour;
  return parsed?.startsWith('#') ? parsed : null;
}

const FROM_CHANNELS: Record<ColourFormat, (c: Channels) => string | null> = {
  [ColourFormat.Hex]: hexChannel,
  [ColourFormat.Rgb]: (c) => hexOf(c.map(Number) as Rgb),
  [ColourFormat.Hsl]: (c) => hexOf(rgbFromHsl(Number(c[0]), Number(c[1]), Number(c[2]))),
  [ColourFormat.Hsb]: (c) => hexOfHsb({ h: Number(c[0]), s: Number(c[1]), b: Number(c[2]) })
};

export const channelsOf = (hex: string, format: ColourFormat): Channels => TO_CHANNELS[format](hex);

export const fromChannels = (format: ColourFormat, channels: Channels): string | null => FROM_CHANNELS[format](channels);
