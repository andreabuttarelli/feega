import { zipSync } from 'fflate';
import { IDENTITY, apply2d, mul2d, type Affine } from './affine';
import { commonGap } from './export-gaps';
import { MaskMode } from './mask';
import { CoverKind } from './gpu-full/mask-layers';
import { ItemKind, PaintKind, type DisplayList, type Item, type MaskLayer, type Paint, type PathItem } from './gpu-full/display-list';
import { FillRule } from './gpu-full/paint';
import type { Rgba } from './gpu-full/rgba';

export type LottieMeta = { width: number; height: number; fps: number };

export type LottieResult = { json: Record<string, unknown>; report: string[] };

type Prop = { a: 0 | 1; k: unknown };
type Values = number[][];

const LOTTIE_VERSION = '5.7.0';
const PERCENT = 100;
const DEGREES = 180 / Math.PI;
const FULL_TURN = 360;
const SKEW_TOLERANCE = 1e-4;
const MIN_SCALE = 1e-6;
const TOLERANCE = { position: 0.05, scale: 0.05, rotation: 0.02, opacity: 0.2, colour: 0.002, point: 0.05, gradient: 0.002 };
const LINEAR = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };

const MASK_MODE: Record<MaskMode, string> = { [MaskMode.Add]: 'a', [MaskMode.Subtract]: 's', [MaskMode.Intersect]: 'i', [MaskMode.Difference]: 'f' };

type Flat = { clip: string; contours: number[][]; paint: Paint; rule: FillRule; opacity: number; matrix: Affine; masks: MaskLayer[] };

type Parent = { matrix: Affine; opacity: number; masks: MaskLayer[] };

type Pose = { x: number; y: number; sx: number; sy: number; rotation: number };

const still = (value: number | number[]): Prop => ({ a: 0, k: value });

function poseOf(m: Affine): Pose | 'skewed' | 'flat' {
  const [a, b, c, d, e, f] = m;
  const sx = Math.hypot(a, b);
  const det = a * d - b * c;
  if (sx < MIN_SCALE || Math.abs(det) < MIN_SCALE) {
    return 'flat';
  }
  const sy = det / sx;
  const shear = (a * c + b * d) / (sx * sx);
  if (Math.abs(shear) > SKEW_TOLERANCE) {
    return 'skewed';
  }
  return { x: e, y: f, sx, sy, rotation: Math.atan2(b, a) * DEGREES };
}

function invert(m: Affine): Affine | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < MIN_SCALE) {
    return null;
  }
  const [a, b, c, d, e, f] = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, 0, 0];
  return [a, b, c, d, e - (a * m[4] + c * m[5]), f - (b * m[4] + d * m[5])];
}

function gapOf(item: Item): string | null {
  const common = commonGap(item);
  if (common) {
    return common;
  }
  if (item.blur > 0) {
    return 'blur';
  }
  if (item.scissor) {
    return 'wipe';
  }
  return null;
}

const KIND_GAP: Partial<Record<ItemKind, string>> = {
  [ItemKind.Image]: 'picture',
  [ItemKind.Layer]: 'live layer',
  [ItemKind.Lens]: 'lens',
  [ItemKind.Glyphs]: 'font glyphs',
  [ItemKind.Text]: 'native text'
};

function maskGap(layer: MaskLayer): string | null {
  if (layer.cover.kind !== CoverKind.Path) {
    return `${layer.cover.kind} mask`;
  }
  return layer.feather > 0 ? 'feathered mask' : null;
}

function flatten(items: readonly Item[], parent: Parent, report: Set<string>): Flat[] {
  return items.flatMap((item): Flat[] => {
    const gap = gapOf(item) ?? (item.masks?.map(maskGap).find(Boolean) ?? null) ?? KIND_GAP[item.kind] ?? null;
    if (gap) {
      report.add(`${item.clip}: ${gap}`);
      return [];
    }
    const masks = [...parent.masks, ...(item.masks ?? [])];
    const opacity = parent.opacity * item.opacity;
    if (item.kind === ItemKind.Group) {
      return flatten(item.items, { matrix: mul2d(parent.matrix, item.matrix), opacity, masks }, report);
    }
    const path = item as PathItem;
    return [{ clip: path.clip, contours: path.contours, paint: path.paint, rule: path.rule, opacity, matrix: mul2d(parent.matrix, path.matrix), masks }];
  });
}

function reduced(frames: number[], values: Values, tolerance: number): number[] {
  const last = frames.length - 1;
  const kept = new Set([0, last]);
  const spans: [number, number][] = [[0, last]];
  while (spans.length) {
    const [lo, hi] = spans.pop()!;
    let worst = -1;
    let deviation = tolerance;
    for (let m = lo + 1; m < hi; m++) {
      const t = (frames[m] - frames[lo]) / (frames[hi] - frames[lo]);
      const off = Math.max(...values[m].map((v, d) => Math.abs(v - (values[lo][d] + (values[hi][d] - values[lo][d]) * t))));
      if (off > deviation) {
        deviation = off;
        worst = m;
      }
    }
    if (worst >= 0) {
      kept.add(worst);
      spans.push([lo, worst], [worst, hi]);
    }
  }
  return [...kept].sort((a, b) => a - b);
}

function eased(frames: number[], values: Values, tolerance: number, scalar = false): Prop {
  const keep = reduced(frames, values, tolerance);
  if (keep.length === 1 || keep.every((i) => values[i].every((v, d) => v === values[0][d]))) {
    return still(scalar ? values[0][0] : values[0]);
  }
  return { a: 1, k: keep.map((i, n) => (n === keep.length - 1 ? { t: frames[i], s: values[i] } : { t: frames[i], s: values[i], ...LINEAR })) };
}

function held<T>(frames: number[], values: T[], single: (v: T) => unknown): Prop {
  const signatures = values.map((v) => JSON.stringify(v));
  const changes = frames.map((_, i) => i).filter((i) => i === 0 || signatures[i] !== signatures[i - 1]);
  if (changes.length === 1) {
    return still(single(values[0]) as number[]);
  }
  return { a: 1, k: changes.map((i) => ({ t: frames[i], s: [single(values[i])], h: 1 })) };
}

function unwrapped(angles: number[]): number[] {
  const out: number[] = [];
  for (const angle of angles) {
    const previous = out.at(-1);
    out.push(previous === undefined ? angle : angle + FULL_TURN * Math.round((previous - angle) / FULL_TURN));
  }
  return out;
}

const bezier = (points: number[], mapPoint: (x: number, y: number) => [number, number]) => {
  const v = Array.from({ length: points.length / 2 }, (_, k) => mapPoint(points[2 * k], points[2 * k + 1]));
  const zeros = v.map(() => [0, 0]);
  return { i: zeros, o: zeros, v, c: true };
};

const EMPTY_PATH = { i: [], o: [], v: [], c: true };

type Bezier = { i: number[][]; o: number[][]; v: number[][]; c: boolean };

const ORIGIN = [0, 0];

function equalised(paths: Bezier[]): Bezier[] {
  const longest = Math.max(...paths.map((p) => p.v.length));
  const pad = (points: number[][]) => [...points, ...Array.from({ length: longest - points.length }, () => points.at(-1) ?? ORIGIN)];
  return paths.map((p) => ({ ...p, v: pad(p.v), i: pad(p.i), o: pad(p.o) }));
}

const colour = (c: Rgba) => [c[0], c[1], c[2], 1];

function gradientStops(paint: Exclude<Paint, { kind: PaintKind.Solid }>): number[] {
  const colours = paint.stops.flatMap((s) => [s.at, s.color[0], s.color[1], s.color[2]]);
  const alphas = paint.stops.some((s) => s.color[3] < 1) ? paint.stops.flatMap((s) => [s.at, s.color[3]]) : [];
  return [...colours, ...alphas];
}

function paintShape(frames: number[], paints: Paint[], rule: FillRule): Record<string, unknown> {
  const first = paints[0];
  const r = rule === FillRule.EvenOdd ? 2 : 1;
  if (first.kind === PaintKind.Solid) {
    const solids = paints.map((p) => (p.kind === PaintKind.Solid ? p.color : first.color));
    return { ty: 'fl', nm: 'fill', c: eased(frames, solids.map(colour), TOLERANCE.colour), o: eased(frames, solids.map((c) => [c[3] * PERCENT]), TOLERANCE.opacity, true), r };
  }
  const same = paints.map((p) => (p.kind === first.kind ? p : first)) as (typeof first)[];
  const start = same.map((p) => (p.kind === PaintKind.Linear ? p.from : (p as Extract<Paint, { kind: PaintKind.Radial }>).center));
  const end = same.map((p) => (p.kind === PaintKind.Linear ? p.to : [(p as Extract<Paint, { kind: PaintKind.Radial }>).center[0] + (p as Extract<Paint, { kind: PaintKind.Radial }>).radius, (p as Extract<Paint, { kind: PaintKind.Radial }>).center[1]]));
  return { ty: 'gf', nm: 'gradient', t: first.kind === PaintKind.Linear ? 1 : 2, s: eased(frames, start, TOLERANCE.point), e: eased(frames, end, TOLERANCE.point), g: { p: first.stops.length, k: held(frames, same, gradientStops) }, o: still(PERCENT), r };
}

const NEUTRAL_TRANSFORM = { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([PERCENT, PERCENT]), r: still(0), o: still(PERCENT), sk: still(0), sa: still(0) };

type Sample = Flat | null;

function maskProps(frames: number[], samples: Sample[], inverses: (Affine | null)[]): Record<string, unknown>[] {
  const reference = samples.find((s): s is Flat => s !== null)!;
  return reference.masks.map((mask, index) => {
    const paths = samples.map((s, f) => {
      const layer = s?.masks[index];
      const inverse = inverses[f];
      if (!layer || layer.cover.kind !== CoverKind.Path || !inverse) {
        return EMPTY_PATH;
      }
      const cover = layer.cover;
      const to = mul2d(inverse, cover.matrix);
      return cover.contours.length ? bezier(cover.contours[0], (x, y) => apply2d(to, [x, y])) : EMPTY_PATH;
    });
    return { nm: `mask ${index + 1}`, mode: MASK_MODE[mask.mode], inv: mask.invert, pt: held(frames, paths, (p) => p), o: still(mask.level * PERCENT), x: still(0) };
  });
}

function layerOf(key: string, index: number, range: [number, number], samples: Sample[], frames: number[]): Record<string, unknown> {
  const present = samples.filter((s): s is Flat => s !== null);
  const reference = present[0];
  const poses = samples.map((s) => (s ? poseOf(s.matrix) : 'flat'));
  const baked = poses.some((p) => p === 'skewed');
  const posed = poses.map((p, f) => (baked ? ({ x: 0, y: 0, sx: 1, sy: 1, rotation: 0 } as Pose) : typeof p === 'string' ? null : { ...p, f }));
  const last = posed.reduce<Pose>((kept, p) => p ?? kept, { x: 0, y: 0, sx: 1, sy: 1, rotation: 0 });
  const steady = posed.map((p) => p ?? last);
  const hidden = samples.map((s, f) => s === null || (!baked && posed[f] === null));
  const opacity = samples.map((s, f) => [hidden[f] ? 0 : s!.opacity * PERCENT]);
  const geometry = samples.map((s) => (s ? (baked ? s.contours.map((c) => bezier(c, (x, y) => apply2d(s.matrix, [x, y]))) : s.contours.map((c) => bezier(c, (x, y) => [x, y]))) : []));
  const contourCount = Math.max(...geometry.map((g) => g.length));
  const inverses = samples.map((s) => (s ? (baked ? IDENTITY : invert(s.matrix)) : null));
  const shapes = Array.from({ length: contourCount }, (_, c) => ({ ty: 'sh', nm: `path ${c + 1}`, ks: held(frames, equalised(geometry.map((g) => g[c] ?? EMPTY_PATH)), (p) => p) }));
  const masks = reference.masks.length ? maskProps(frames, samples, inverses) : [];
  const group = { ty: 'gr', nm: key, it: [...shapes, paintShape(frames, samples.map((s) => (s ?? reference).paint), reference.rule), NEUTRAL_TRANSFORM] };
  return {
    ddd: 0,
    ind: index + 1,
    ty: 4,
    nm: key,
    sr: 1,
    ks: {
      o: eased(frames, opacity, TOLERANCE.opacity, true),
      r: eased(frames, unwrapped(steady.map((p) => p.rotation)).map((r) => [r]), TOLERANCE.rotation, true),
      p: eased(frames, steady.map((p) => [p.x, p.y, 0]), TOLERANCE.position),
      a: still([0, 0, 0]),
      s: eased(frames, steady.map((p) => [p.sx * PERCENT, p.sy * PERCENT, PERCENT]), TOLERANCE.scale)
    },
    ao: 0,
    shapes: [group],
    ...(masks.length ? { hasMask: true, masksProperties: masks } : {}),
    ip: range[0],
    op: range[1],
    st: 0,
    bm: 0
  };
}

function backgroundLayer(index: number, meta: LottieMeta, frames: number, colourOf: Rgba): Record<string, unknown> {
  const rect = bezier([0, 0, meta.width, 0, meta.width, meta.height, 0, meta.height], (x, y) => [x, y]);
  const fill = { ty: 'fl', nm: 'fill', c: still(colour(colourOf)), o: still(colourOf[3] * PERCENT), r: 1 };
  return { ddd: 0, ind: index, ty: 4, nm: 'background', sr: 1, ks: { o: still(PERCENT), r: still(0), p: still([0, 0, 0]), a: still([0, 0, 0]), s: still([PERCENT, PERCENT, PERCENT]) }, ao: 0, shapes: [{ ty: 'gr', nm: 'background', it: [{ ty: 'sh', nm: 'rect', ks: still(rect as never) }, fill, NEUTRAL_TRANSFORM] }], ip: 0, op: frames, st: 0, bm: 0 };
}

function orderOf(perFrame: { key: string }[][]): string[] {
  const order: string[] = [];
  for (const entries of perFrame) {
    entries.forEach((entry, i) => {
      if (order.includes(entry.key)) {
        return;
      }
      const before = i === 0 ? -1 : order.indexOf(entries[i - 1].key);
      order.splice(before + 1, 0, entry.key);
    });
  }
  return order;
}

export function lottieOf(lists: readonly DisplayList[], meta: LottieMeta): LottieResult {
  const report = new Set<string>();
  const perFrame = lists.map((list) => {
    const seen = new Map<string, number>();
    return flatten(list.items, { matrix: IDENTITY, opacity: 1, masks: [] }, report).map((flat) => {
      const ordinal = seen.get(flat.clip) ?? 0;
      seen.set(flat.clip, ordinal + 1);
      return { key: `${flat.clip}:${ordinal}`, flat };
    });
  });
  lists.forEach((list) => list.unsupported.forEach((g) => report.add(`${g.clip} (${g.component}): ${g.detail ?? g.reason}`)));
  const frames = lists.map((_, f) => f);
  const order = orderOf(perFrame);
  const byKey = new Map<string, Sample[]>(order.map((key) => [key, perFrame.map((entries) => entries.find((e) => e.key === key)?.flat ?? null)]));
  const layers = order.map((key, index) => {
    const samples = byKey.get(key)!;
    const present = samples.map((s, f) => (s ? f : -1)).filter((f) => f >= 0);
    const range: [number, number] = [present[0], present.at(-1)! + 1];
    return layerOf(key, index, range, samples.slice(range[0], range[1]), frames.slice(range[0], range[1]));
  });
  const bottom = lists[0]?.background ? [backgroundLayer(layers.length + 1, meta, lists.length, lists[0].background)] : [];
  const json = { v: LOTTIE_VERSION, fr: meta.fps, ip: 0, op: Math.max(1, lists.length), w: meta.width, h: meta.height, nm: 'feega', ddd: 0, assets: [], layers: [...layers.reverse(), ...bottom] };
  return { json, report: [...report] };
}

const MANIFEST = { version: '1', generator: 'feega', animations: [{ id: 'animation' }] };

export function dotLottieOf(json: Record<string, unknown>): Uint8Array {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  return zipSync({ 'manifest.json': encode(MANIFEST), 'animations/animation.json': encode(json) });
}
