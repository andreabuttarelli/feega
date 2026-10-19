import { mul2d, type Affine } from '../../affine';
import type { SvgNode } from '../../effects/registry';
import { flatten, type Outline } from '../../shape/geometry';
import { FillRule, MAX_STOPS, PaintKind, type Paint, type Stop } from '../paint';
import { rgbaOf } from '../rgba';
import { Cap, Join, dashes, strokePolygons } from '../stroke';
import { isNone, lengthOf, type Size } from './css';
import type { RawNode } from './tree';

export type Fill = { contours: number[][]; rule: FillRule; paint: Paint; opacity: number; matrix: Affine };

export enum PaintGap {
  Paint = 'paint',
  Stroke = 'stroke'
}

type Style = RawNode['style'];
type Defs = Record<string, SvgNode>;
type Box = { x: number; y: number; w: number; h: number };
type Target = { contours: number[][]; rule: FillRule; opacity: number; matrix: Affine; viewport: Size; rect: boolean };
type Server = (def: SvgNode, target: Target) => Fill[] | PaintGap;

const REFERENCE = /^url\(\s*["']?#([^"')]+)["']?\s*\)$/;
const BOUNDING_BOX = 'objectBoundingBox';
const USER_SPACE = 'userSpaceOnUse';
const BLACK = '#000000';
const MAX_TILES = 20_000;
const CAPS = new Set<string>(Object.values(Cap));
const JOINS = new Set<string>(Object.values(Join));
const EPSILON = 1e-9;

const num = (v: unknown, fallback: number, basis = 1) => (v === undefined ? fallback : (lengthOf(String(v), basis) ?? fallback));

function boxOf(contours: number[][]): Box | null {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  if (!xs.length) {
    return null;
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return w > EPSILON && h > EPSILON ? { x, y, w, h } : null;
}

function stopsOf(def: SvgNode): Stop[] | null {
  const stops = (def.children ?? [])
    .filter((c) => c.tag === 'stop')
    .map((c) => {
      const color = rgbaOf(String(c.attrs['stop-color'] ?? BLACK)) ?? [0, 0, 0, 1];
      return { at: Math.min(1, Math.max(0, num(c.attrs.offset, 0))), color: [color[0], color[1], color[2], color[3] * num(c.attrs['stop-opacity'], 1)] as Stop['color'] };
    });
  stops.forEach((s, i) => (s.at = Math.max(s.at, stops[i - 1]?.at ?? 0)));
  return stops.length && stops.length <= MAX_STOPS ? stops : null;
}

const GRADIENT_PAINT: Record<string, (a: SvgNode['attrs'], stops: Stop[], basis: Size) => Paint | null> = {
  lineargradient: (a, stops, b) => ({ kind: PaintKind.Linear, from: [num(a.x1, 0, b.w), num(a.y1, 0, b.h)], to: [num(a.x2, b.w, b.w), num(a.y2, 0, b.h)], stops }),
  radialgradient: (a, stops, b) => (a.fx !== undefined || a.fy !== undefined || b.w !== b.h ? null : { kind: PaintKind.Radial, center: [num(a.cx, b.w / 2, b.w), num(a.cy, b.h / 2, b.h)], radius: num(a.r, b.w / 2, b.w), stops })
};

const gradient: Server = (def, target) => {
  const stops = stopsOf(def);
  const user = def.attrs.gradientUnits === USER_SPACE;
  const box = boxOf(target.contours);
  if (!stops || def.attrs.gradientTransform !== undefined || (!user && !box)) {
    return PaintGap.Paint;
  }
  if (stops.length === 1) {
    return [{ ...target, paint: { kind: PaintKind.Solid, color: stops[0].color } }];
  }
  const paint = GRADIENT_PAINT[def.tag.toLowerCase()](def.attrs, stops, user ? target.viewport : { w: 1, h: 1 });
  if (!paint) {
    return PaintGap.Paint;
  }
  if (user) {
    return [{ ...target, paint }];
  }
  const { x, y, w, h } = box as Box;
  const unit = target.contours.map((c) => c.map((v, i) => (i % 2 === 0 ? (v - x) / w : (v - y) / h)));
  return [{ ...target, contours: unit, paint, matrix: mul2d(target.matrix, [w, 0, 0, h, x, y]) }];
};

function runs(start: number, end: number, origin: number, tile: number, offset: number, size: number, spans: boolean): [number, number][] {
  if (spans) {
    return [[start, end]];
  }
  const out: [number, number][] = [];
  for (let t = origin + Math.floor((start - origin) / tile) * tile; t < end; t += tile) {
    const a = Math.max(start, t + offset);
    const b = Math.min(end, t + offset + size);
    if (b > a) {
      out.push([a, b]);
    }
  }
  return out;
}

const pattern: Server = (def, target) => {
  const a = def.attrs;
  const box = boxOf(target.contours);
  const children = def.children ?? [];
  const plain = a.patternUnits === USER_SPACE && a.patternTransform === undefined && a.viewBox === undefined && children.every((c) => c.tag === 'rect');
  const tw = num(a.width, 0);
  const th = num(a.height, 0);
  if (!plain || !box || !target.rect || tw <= 0 || th <= 0) {
    return PaintGap.Paint;
  }
  const fills: Fill[] = [];
  for (const child of children) {
    const c = child.attrs;
    const [cx, cy, cw, ch] = [num(c.x, 0), num(c.y, 0), num(c.width, 0), num(c.height, 0)];
    const color = rgbaOf(String(c.fill ?? BLACK));
    if (!color) {
      return PaintGap.Paint;
    }
    const xs = runs(box.x, box.x + box.w, num(a.x, 0), tw, cx, cw, cx <= 0 && cx + cw >= tw);
    const ys = runs(box.y, box.y + box.h, num(a.y, 0), th, cy, ch, cy <= 0 && cy + ch >= th);
    if (xs.length * ys.length > MAX_TILES) {
      return PaintGap.Paint;
    }
    const contours = ys.flatMap(([y0, y1]) => xs.map(([x0, x1]) => [x0, y0, x1, y0, x1, y1, x0, y1]));
    if (contours.length) {
      fills.push({ ...target, contours, rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color }, opacity: target.opacity * num(c.opacity, 1) * num(c['fill-opacity'], 1) });
    }
  }
  return fills;
};

const SERVERS: Record<string, Server> = { lineargradient: gradient, radialgradient: gradient, pattern };

function painted(value: string | undefined, defs: Defs, target: Target): Fill[] | PaintGap {
  if (isNone(value)) {
    return [];
  }
  const id = REFERENCE.exec((value ?? '').trim())?.[1];
  if (id) {
    const def = defs[id];
    const server = def ? SERVERS[def.tag.toLowerCase()] : undefined;
    return server ? server(def, target) : PaintGap.Paint;
  }
  const color = rgbaOf(value ?? '');
  if (!color) {
    return PaintGap.Paint;
  }
  return color[3] === 0 ? [] : [{ ...target, paint: { kind: PaintKind.Solid, color } }];
}

export type Shape = { outline: Outline; matrix: Affine; viewport: Size; rect: boolean };

export function svgFill(style: Style, defs: Defs, shape: Shape): Fill[] | PaintGap {
  const rule = style['fill-rule'] === FillRule.EvenOdd ? FillRule.EvenOdd : FillRule.NonZero;
  const contours = shape.outline.map((c) => flatten(c).flatMap(([x, y]) => [x, y]));
  return painted(style.fill, defs, { contours, rule, opacity: num(style['fill-opacity'], 1), matrix: shape.matrix, viewport: shape.viewport, rect: shape.rect });
}

function dashPattern(value: string | undefined): [number, number] | null | false {
  if (isNone(value)) {
    return null;
  }
  const parts = (value ?? '').split(/[\s,]+/).filter(Boolean).map((v) => parseFloat(v));
  return parts.length > 2 || parts.some((v) => !Number.isFinite(v)) ? false : [parts[0], parts[1] ?? parts[0]];
}

export function svgStroke(style: Style, defs: Defs, shape: Shape): Fill[] | PaintGap {
  const width = parseFloat(style['stroke-width'] ?? '') || 0;
  if (isNone(style.stroke) || width <= 0) {
    return [];
  }
  const cap = style['stroke-linecap'] ?? Cap.Butt;
  const join = style['stroke-linejoin'] ?? Join.Miter;
  const dash = dashPattern(style['stroke-dasharray']);
  if (!CAPS.has(cap) || !JOINS.has(join) || dash === false) {
    return PaintGap.Stroke;
  }
  const contours = shape.outline.flatMap((c) => {
    const pts = flatten(c).flatMap(([x, y]) => [x, y]);
    const pieces = dash ? dashes(pts, c.closed, dash[0], dash[1]).map((d) => ({ pts: d, closed: false })) : [{ pts, closed: c.closed }];
    return pieces.flatMap((p) => strokePolygons(p.pts, p.closed, width, cap as Cap, join as Join));
  });
  const fills = painted(style.stroke, defs, { contours, rule: FillRule.Union, opacity: num(style['stroke-opacity'], 1), matrix: shape.matrix, viewport: shape.viewport, rect: false });
  return typeof fills === 'string' ? PaintGap.Stroke : fills;
}
