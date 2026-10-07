import type { MotionDoc } from '../doc';
import { findClip } from '../doc';
import type { OpResult } from '../timeline';
import { LUT_NODES, type CompiledLut } from './lut-model';
import { setEffect } from './ops';
import { EffectKind } from './registry';

export type Rgb = [number, number, number];
export type Cube = { size: number; table: number[]; min: Rgb; max: Rgb };
type Look = (c: Rgb) => Rgb;

const MIN_SIZE = 2;
const MAX_SIZE = 65;
const FIT_GRID = 9;
const SINGULAR = 1e-12;
const EMPTY = 1e-6;
const DECIMALS = 10000;

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number) => Math.round(x * DECIMALS) / DECIMALS;

export function parseCube(text: string): Cube | string {
  let size = 0;
  let min: Rgb = [0, 0, 0];
  let max: Rgb = [1, 1, 1];
  const table: number[] = [];
  const triple = (parts: string[]) => parts.slice(1, 4).map(Number) as Rgb;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('TITLE')) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts[0] === 'LUT_3D_SIZE') {
      size = Number(parts[1]);
      continue;
    }
    if (parts[0] === 'DOMAIN_MIN') {
      min = triple(parts);
      continue;
    }
    if (parts[0] === 'DOMAIN_MAX') {
      max = triple(parts);
      continue;
    }
    const values = parts.map(Number);
    if (values.length === 3 && values.every(Number.isFinite)) {
      table.push(...values);
    }
  }

  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    return `not a 3D .cube file: LUT_3D_SIZE ${MIN_SIZE}..${MAX_SIZE} is missing`;
  }
  const expected = size ** 3;
  if (table.length !== expected * 3) {
    return `the .cube declares ${expected} entries and holds ${table.length / 3}`;
  }
  return { size, table, min, max };
}

function sampler(cube: Cube): Look {
  const n = cube.size - 1;
  const at = (r: number, g: number, b: number, c: number) => cube.table[(r + g * cube.size + b * cube.size * cube.size) * 3 + c];
  return (rgb) => {
    const pos = rgb.map((v, i) => clamp((v - cube.min[i]) / (cube.max[i] - cube.min[i] || 1)) * n);
    const lo = pos.map((p) => Math.min(Math.floor(p), n - 1));
    const t = pos.map((p, i) => p - lo[i]);
    return [0, 1, 2].map((c) => {
      let sum = 0;
      for (let corner = 0; corner < 8; corner++) {
        const bit = [corner & 1, (corner >> 1) & 1, (corner >> 2) & 1];
        const weight = bit.reduce((w, on, i) => w * (on ? t[i] : 1 - t[i]), 1);
        sum += weight * at(lo[0] + bit[0], lo[1] + bit[1], lo[2] + bit[2], c);
      }
      return sum;
    }) as Rgb;
  };
}

function solve(a: number[][], y: number[]): number[] {
  const m = a.map((row, i) => [...row, y[i]]);
  const size = y.length;
  for (let col = 0; col < size; col++) {
    const pivot = m.slice(col).reduce((best, row, i) => (Math.abs(row[col]) > Math.abs(m[best][col]) ? col + i : best), col);
    [m[col], m[pivot]] = [m[pivot], m[col]];
    if (Math.abs(m[col][col]) < SINGULAR) {
      continue;
    }
    for (let row = 0; row < size; row++) {
      if (row === col) {
        continue;
      }
      const f = m[row][col] / m[col][col];
      m[row] = m[row].map((v, k) => v - f * m[col][k]);
    }
  }
  return m.map((row, i) => (Math.abs(row[i]) < SINGULAR ? 0 : row[size] / row[i]));
}

const affine = (matrix: number[], [r, g, b]: Rgb, c: number) => matrix[c * 4] * r + matrix[c * 4 + 1] * g + matrix[c * 4 + 2] * b + matrix[c * 4 + 3];

function curveAt(curve: number[], x: number): number {
  const pos = clamp(x) * (curve.length - 1);
  const i = Math.min(Math.floor(pos), curve.length - 2);
  return curve[i] + (curve[i + 1] - curve[i]) * (pos - i);
}

export function evalLut(lut: CompiledLut, rgb: Rgb): Rgb {
  return [0, 1, 2].map((c) => curveAt(lut.curves[c], affine(lut.matrix, rgb, c))) as Rgb;
}

function gridSamples(look: Look): { input: Rgb; output: Rgb }[] {
  const steps = Array.from({ length: FIT_GRID }, (_, i) => i / (FIT_GRID - 1));
  return steps.flatMap((r) => steps.flatMap((g) => steps.map((b) => ({ input: [r, g, b] as Rgb, output: look([r, g, b]) }))));
}

function fitMatrix(samples: { input: Rgb; output: Rgb }[]): number[] {
  const rows = samples.map((s) => [...s.input, 1]);
  const normal = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => rows.reduce((sum, row) => sum + row[i] * row[j], 0)));
  return [0, 1, 2].flatMap((c) => solve(normal, [0, 1, 2, 3].map((i) => rows.reduce((sum, row, k) => sum + row[i] * samples[k].output[c], 0))));
}

function fitCurve(samples: { input: Rgb; output: Rgb }[], matrix: number[], c: number): number[] {
  const last = LUT_NODES - 1;
  return Array.from({ length: LUT_NODES }, (_, k) => {
    let weight = 0;
    let total = 0;
    for (const s of samples) {
      const w = Math.max(0, 1 - Math.abs(clamp(affine(matrix, s.input, c)) * last - k));
      weight += w;
      total += w * s.output[c];
    }
    return round(clamp(weight > EMPTY ? total / weight : k / last));
  });
}

export function compileLut(look: Look, name: string): CompiledLut {
  const samples = gridSamples(look);
  const matrix = fitMatrix(samples).map(round);
  const curves = [0, 1, 2].map((c) => fitCurve(samples, matrix, c)) as CompiledLut['curves'];
  return { name, matrix, curves };
}

export function lutFromCube(text: string, name: string): CompiledLut | string {
  const cube = parseCube(text);
  return typeof cube === 'string' ? cube : compileLut(sampler(cube), name);
}

export enum LutPreset {
  TealOrange = 'teal-orange',
  WarmFilm = 'warm-film',
  CoolNight = 'cool-night',
  BleachBypass = 'bleach-bypass',
  Sepia = 'sepia'
}

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const sCurve = (x: number, k: number) => clamp(0.5 + (x - 0.5) * k);
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i] - v) * t) as Rgb;

export const LUT_PRESETS: Record<LutPreset, { label: string; look: Look }> = {
  [LutPreset.TealOrange]: {
    label: 'Teal & orange',
    look: (c) => {
      const y = luma(c);
      return mixRgb(c, [clamp(y * 1.25 + 0.05), clamp(y * 0.95 + 0.04), clamp(y * 0.75 + 0.12 * (1 - y))], 0.45).map((v) => sCurve(v, 1.12)) as Rgb;
    }
  },
  [LutPreset.WarmFilm]: {
    label: 'Warm film',
    look: ([r, g, b]) => [clamp(0.04 + r * 0.98), clamp(0.02 + g * 0.93), clamp(0.03 + b * 0.82)].map((v) => sCurve(v, 1.08)) as Rgb
  },
  [LutPreset.CoolNight]: {
    label: 'Cool night',
    look: ([r, g, b]) => [clamp(r * 0.8), clamp(g * 0.9 + 0.02), clamp(b * 1.05 + 0.06)].map((v) => sCurve(v, 1.1)) as Rgb
  },
  [LutPreset.BleachBypass]: {
    label: 'Bleach bypass',
    look: (c) => mixRgb(c, [luma(c), luma(c), luma(c)], 0.55).map((v) => sCurve(v, 1.3)) as Rgb
  },
  [LutPreset.Sepia]: {
    label: 'Sepia',
    look: (c) => {
      const y = luma(c);
      return [clamp(y * 1.07 + 0.05), clamp(y * 0.9 + 0.03), clamp(y * 0.7)];
    }
  }
};

export const LUT_PRESET_IDS = Object.values(LutPreset) as [LutPreset, ...LutPreset[]];

export function applyLut(doc: MotionDoc, clipId: string, effectId: string, lut: CompiledLut | null): OpResult {
  const effect = findClip(doc, clipId)?.clip.effects.find((e) => e.id === effectId);
  if (effect && effect.kind !== EffectKind.Lut) {
    return { ok: false, error: `${effectId} is not a LUT effect` };
  }
  return setEffect(doc, clipId, effectId, { lut });
}
