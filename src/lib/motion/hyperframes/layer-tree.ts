import type { GrainArea } from '../effects/grain';

export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export enum PaintKind {
  Sheet = 'sheet',
  Fill = 'fill'
}

export type Rgba = [number, number, number, number];

export type Paint = { kind: PaintKind.Sheet; sheet: number; width: number; height: number; at: Affine } | { kind: PaintKind.Fill; color: Rgba; width: number; height: number; at: Affine };

export enum EffectKind {
  Grain = 'grain'
}

export type Grain = { baseFrequency: number; seed: number; amount: number };

export type Effect = { kind: EffectKind.Grain; grains: Grain[]; area: GrainArea };

export type LayerNode = { paints: Paint[]; children: LayerNode[]; opacity: number; blend: string; effects: Effect[]; clip: Paint | null };

export type LayerTree = { width: number; height: number; backdrop: Rgba | null; root: LayerNode };

export function node(part: Partial<LayerNode>): LayerNode {
  return { paints: [], children: [], opacity: 1, blend: 'normal', effects: [], clip: null, ...part };
}

export function chain(outer: Affine, inner: Affine): Affine {
  const [a, b, c, d, e, f] = outer;
  const [p, q, r, s, t, u] = inner;
  return [a * p + c * q, b * p + d * q, a * r + c * s, b * r + d * s, a * t + c * u + e, b * t + d * u + f];
}

export function cssAffine(transform: string, origin: string): Affine | null {
  const matrix = /^matrix\(([^)]+)\)$/.exec(transform);
  if (transform !== 'none' && !matrix) {
    return null;
  }
  const [a, b, c, d, e, f] = matrix ? matrix[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
  const [ox, oy] = origin.split(' ').map(parseFloat);
  return [a, b, c, d, e + ox - (a * ox + c * oy), f + oy - (b * ox + d * oy)];
}

export function cssRgba(value: string): Rgba | null {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(value);
  const alpha = m ? Number(m[4] ?? 1) : 0;
  return m && alpha > 0 ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, alpha] : null;
}

export type Raster<E> = { raster: E[] };

export function joinRasters<T extends object, E>(items: (T | Raster<E> | null)[]): (T | Raster<E>)[] {
  const out: (T | Raster<E>)[] = [];
  for (const item of items) {
    if (!item) {
      continue;
    }
    const last = out[out.length - 1];
    if ('raster' in item && last && 'raster' in last) {
      last.raster.push(...(item as Raster<E>).raster);
      continue;
    }
    out.push('raster' in item ? { raster: [...(item as Raster<E>).raster] } : item);
  }
  return out;
}
