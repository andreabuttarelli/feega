import { z } from 'zod';
import type { SvgNode } from '../effects/registry';

export enum Adjustment {
  Exposure = 'exposure',
  Contrast = 'contrast',
  Saturation = 'saturation',
  Temperature = 'temperature',
  Tint = 'tint',
  Highlights = 'highlights',
  Shadows = 'shadows'
}

export const ADJUSTMENTS = Object.values(Adjustment) as [Adjustment, ...Adjustment[]];

export const ADJUSTMENT_LABEL: Record<Adjustment, string> = {
  [Adjustment.Exposure]: 'Exposure',
  [Adjustment.Contrast]: 'Contrast',
  [Adjustment.Saturation]: 'Saturation',
  [Adjustment.Temperature]: 'Temperature',
  [Adjustment.Tint]: 'Tint',
  [Adjustment.Highlights]: 'Highlights',
  [Adjustment.Shadows]: 'Shadows'
};

const amount = z.number().min(-1).max(1);

export const adjustSchema = z.object({
  exposure: amount.optional(),
  contrast: amount.optional(),
  saturation: amount.optional(),
  temperature: amount.optional(),
  tint: amount.optional(),
  highlights: amount.optional(),
  shadows: amount.optional()
});

export type Adjust = z.infer<typeof adjustSchema>;

type Matrix = number[];

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const LUMA = [0.2126, 0.7152, 0.0722];
const EXPOSURE_STOPS = 1;
const WARMTH = 0.12;
const MAGENTA = 0.12;
const MAGENTA_SIDE = 0.06;
const MID = 0.5;
const TONE_STEPS = 17;
const SHADOW_REACH = 0.8;
const HIGHLIGHT_REACH = 0.8;
const DIGITS = 10000;

const level = (adjust: Adjust, key: Adjustment) => adjust[key] ?? 0;

export const isNeutral = (adjust: Adjust | undefined): boolean => !adjust || ADJUSTMENTS.every((key) => level(adjust, key) === 0);

function after(first: Matrix, then: Matrix): Matrix {
  const out: Matrix = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const through = [0, 1, 2, 3].reduce((sum, k) => sum + then[row * 5 + k] * first[k * 5 + col], 0);
      out.push(through + (col === 4 ? then[row * 5 + 4] : 0));
    }
  }
  return out;
}

const gain = (g: number): Matrix => [g, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, 1, 0];

const balance = (temperature: number, tint: number): Matrix => [1, 0, 0, 0, WARMTH * temperature + MAGENTA_SIDE * tint, 0, 1, 0, 0, -MAGENTA * tint, 0, 0, 1, 0, -WARMTH * temperature + MAGENTA_SIDE * tint, 0, 0, 0, 1, 0];

const contrast = (c: number): Matrix => {
  const k = 1 + c;
  return [k, 0, 0, 0, MID - MID * k, 0, k, 0, 0, MID - MID * k, 0, 0, k, 0, MID - MID * k, 0, 0, 0, 1, 0];
};

const saturation = (s: number): Matrix => {
  const k = 1 + s;
  const row = (own: number) => LUMA.map((w, i) => w * (1 - k) + (i === own ? k : 0));
  return [...row(0), 0, 0, ...row(1), 0, 0, ...row(2), 0, 0, 0, 0, 0, 1, 0];
};

function matrixOf(adjust: Adjust): Matrix {
  const steps = [gain(2 ** (level(adjust, Adjustment.Exposure) * EXPOSURE_STOPS)), balance(level(adjust, Adjustment.Temperature), level(adjust, Adjustment.Tint)), contrast(level(adjust, Adjustment.Contrast)), saturation(level(adjust, Adjustment.Saturation))];
  return steps.reduce(after, IDENTITY);
}

function toneAt(adjust: Adjust, x: number): number {
  const shadows = level(adjust, Adjustment.Shadows) * SHADOW_REACH * x * (1 - x) ** 2;
  const highlights = level(adjust, Adjustment.Highlights) * HIGHLIGHT_REACH * x ** 2 * (1 - x);
  return Math.min(1, Math.max(0, x + shadows + highlights));
}

export type AdjustLook = { matrix: number[]; table: number[] };

export function adjustLook(adjust: Adjust | undefined): AdjustLook | null {
  if (!adjust || isNeutral(adjust)) {
    return null;
  }
  return { matrix: matrixOf(adjust), table: Array.from({ length: TONE_STEPS }, (_, i) => toneAt(adjust, i / (TONE_STEPS - 1))) };
}

const rounded = (values: number[]) => values.map((v) => Math.round(v * DIGITS) / DIGITS).join(' ');

export function adjustNodes(adjust: Adjust, id: string): SvgNode {
  const { matrix, table } = adjustLook(adjust)!;
  const curve = (tag: string): SvgNode => ({ tag, attrs: { type: 'table', tableValues: rounded(table) } });
  return {
    tag: 'filter',
    attrs: { id, 'color-interpolation-filters': 'sRGB' },
    children: [
      { tag: 'feColorMatrix', attrs: { type: 'matrix', values: rounded(matrix) } },
      { tag: 'feComponentTransfer', attrs: {}, children: [curve('feFuncR'), curve('feFuncG'), curve('feFuncB')] }
    ]
  };
}

export type Tone = { id: string; matrix: string; curve: string };

const hashed = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);

export function toneOf(adjust: Adjust | undefined): Tone | undefined {
  const made = adjustLook(adjust);
  if (!made) {
    return undefined;
  }
  const matrix = rounded(made.matrix);
  const curve = rounded(made.table);
  return { id: `adj-${hashed(`${matrix}|${curve}`)}`, matrix, curve };
}
