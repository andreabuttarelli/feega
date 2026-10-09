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
  Grain = 'grain',
  Blur = 'blur'
}

export type Grain = { baseFrequency: number; seed: number; amount: number };

export type Effect = { kind: EffectKind.Grain; grains: Grain[]; area: GrainArea } | { kind: EffectKind.Blur; sigma: number };

export type FilterStep = { kind: EffectKind.Grain; grain: Grain } | { kind: EffectKind.Blur; sigma: number };

export type Filter = { kind: EffectKind.Grain; grains: Grain[] } | { kind: EffectKind.Blur; sigma: number };

export enum MaskComposite {
  Add = 'add',
  Subtract = 'subtract',
  Intersect = 'intersect',
  Exclude = 'exclude'
}

export type Mask = { paint: Paint; composite: MaskComposite };

export type LayerNode = { paints: Paint[]; children: LayerNode[]; opacity: number; blend: string; effects: Effect[]; clip: Paint | null; masks: Mask[] };

export type LayerTree = { width: number; height: number; pad: number; backdrop: Rgba | null; root: LayerNode };

export function node(part: Partial<LayerNode>): LayerNode {
  return { paints: [], children: [], opacity: 1, blend: 'normal', effects: [], clip: null, masks: [], ...part };
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

export type CssMask = { url: string; composite: MaskComposite };

export function cssMasks(image: string, composite: string): CssMask[] | null {
  const NAMES: Record<string, string> = { add: 'add', 'source-over': 'add', subtract: 'subtract', 'source-out': 'subtract', intersect: 'intersect', 'source-in': 'intersect', exclude: 'exclude', xor: 'exclude' };
  if (!image || image === 'none') {
    return [];
  }
  const urls = [...image.matchAll(/url\("(data:[^"]+)"\)/g)].map((m) => m[1]);
  if (!urls.length || image.replace(/url\("data:[^"]+"\)/g, '').replace(/[\s,]/g, '')) {
    return null;
  }
  const ops = composite.split(',').map((op) => NAMES[op.trim()] ?? 'add');
  return urls.map((url, i) => ({ url, composite: ops[i % ops.length] as MaskComposite }));
}

export function cssFilters(filter: string, lookup: (id: string) => FilterStep | null): Filter[] | null {
  const GRAIN = 'grain' as EffectKind.Grain;
  const TOKEN = /[a-z-]+\((?:"[^"]*"|[^)])*\)/g;
  if (!filter || filter === 'none') {
    return [];
  }
  if (filter.replace(TOKEN, '').trim()) {
    return null;
  }
  const steps: FilterStep[] = [];
  for (const token of filter.match(TOKEN) ?? []) {
    const ref = /^url\("?#([^")]+)"?\)$/.exec(token);
    const blur = /^blur\(([\d.]+)px\)$/.exec(token);
    const step = ref ? lookup(ref[1]) : blur ? ({ kind: 'blur', sigma: Number(blur[1]) } as FilterStep) : null;
    if (!step) {
      return null;
    }
    steps.push(step);
  }
  const out: Filter[] = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (step.kind === GRAIN && last?.kind === GRAIN) {
      last.grains.push(step.grain);
      continue;
    }
    out.push(step.kind === GRAIN ? { kind: GRAIN, grains: [step.grain] } : step);
  }
  return out;
}
