import { cornerRadii, ellipseOutline, parsePath, pathData, polygonOutline, rectOutline, scaled, starOutline, type Outline, type Size } from './geometry';
import { EMPTY_NETWORK, type VectorNetwork } from '../vector/model';
import { networkFill, networkStroke } from '../vector/outline';
import { morphOutline } from './morph';
import { IDENTITY, applyModifiers, modifierFilter, modifierReach, type AppliedModifier, type Layer } from './modifiers';
import { ShapeKind, modifierValues, type Modifier } from './schema';
import { fillsOf } from '../fill/model';
import { svgFills } from '../fill/render';
import { SIDED, strokesOf } from '../stroke/model';
import { strokeReach, svgStrokes } from '../stroke/render';

export type ShapeLook = {
  shape: ShapeKind;
  path: string;
  network?: VectorNetwork;
  roundness: number;
  smoothing?: number;
  corners?: number[];
  sides: number;
  points: number;
  innerRadius: number;
  morphs: string[];
  morph: number;
  morphStart: number;
  modifiers: Modifier[];
  fills?: unknown;
  strokes?: unknown;
  fillKind: string;
  fill: string;
  fill2: string;
  gradientAngle: number;
  fillRule: string;
  strokeKind: string;
  stroke: string;
  strokeWidth: number;
  dash: number;
  gap: number;
  cap: string;
  join: string;
};

export type Paint = { id: string; size: Size; unit: number; time: number; color: (value: string) => string; asset?: (id: string | null) => string | null };

const DIGITS = 1000;
const round = (n: number) => Math.round(n * DIGITS) / DIGITS;

export function pathOutline(d: string, size: Size): Outline {
  const outline = d ? parsePath(d) : [];
  return typeof outline === 'string' ? [] : scaled(outline, size);
}

const OUTLINE: Record<ShapeKind, (p: ShapeLook, size: Size) => Outline> = {
  [ShapeKind.Rect]: (p, size) => rectOutline(cornerRadii(p.roundness, p.corners ?? []), size, p.smoothing ?? 0),
  [ShapeKind.Line]: (_p, size) => rectOutline(0, size),
  [ShapeKind.Circle]: (_p, size) => ellipseOutline(size),
  [ShapeKind.Ellipse]: (_p, size) => ellipseOutline(size),
  [ShapeKind.Polygon]: (p, size) => polygonOutline(p.sides, p.roundness, size),
  [ShapeKind.Star]: (p, size) => starOutline(p.points, p.innerRadius, p.roundness, size),
  [ShapeKind.Path]: (p, size) => pathOutline(p.path, size),
  [ShapeKind.Vector]: (p, size) => scaled(networkStroke(p.network ?? EMPTY_NETWORK), size)
};

const FILL_OUTLINE: Partial<Record<ShapeKind, (p: ShapeLook, size: Size) => Outline>> = {
  [ShapeKind.Vector]: (p, size) => scaled(networkFill(p.network ?? EMPTY_NETWORK), size)
};

export function baseOutline(p: ShapeLook, size: Size): Outline {
  return OUTLINE[p.shape](p, size);
}

const stackOf = (p: ShapeLook): AppliedModifier[] => p.modifiers.filter((m) => m.enabled).map((m) => ({ kind: m.kind, values: modifierValues(m) }));

export function shapeLayers(p: ShapeLook, size: Size, time: number): Layer[] {
  const base = baseOutline(p, size);
  const outline = p.morphs.length ? morphOutline([base, ...p.morphs.map((d) => pathOutline(d, size))], p.morph, p.morphStart) : base;
  return applyModifiers([{ outline, opacity: 1, matrix: IDENTITY }], stackOf(p), { size, time });
}

const filterId = (id: string) => `sf-${id}`;

export type Extent = { left: number; top: number; right: number; bottom: number };

function drawnBounds(layers: Layer[]): Extent | null {
  const points = layers.flatMap((l) => l.outline.flatMap((c) => c.vertices.flatMap((v) => [v.p, v.in, v.out])).map(([x, y]) => [l.matrix[0] * x + l.matrix[2] * y + l.matrix[4], l.matrix[1] * x + l.matrix[3] * y + l.matrix[5]]));
  if (!points.length) {
    return null;
  }
  const xs = points.map((pt) => pt[0]);
  const ys = points.map((pt) => pt[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

function paintedExtent(p: ShapeLook, paint: Paint, layers: Layer[]): Extent | null {
  const drawn = drawnBounds(layers);
  if (!drawn) {
    return null;
  }
  const reach = modifierReach(stackOf(p), paint.unit) + strokeReach(strokesOf(p), paint.unit);
  return { left: drawn.left - reach, top: drawn.top - reach, right: drawn.right + reach, bottom: drawn.bottom + reach };
}

export function unionExtent(a: Extent | null, b: Extent | null): Extent | null {
  if (!a || !b) {
    return a ?? b;
  }
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

function filterOf(p: ShapeLook, paint: Paint, extent: Extent | null): string {
  const primitives = modifierFilter(stackOf(p), paint.unit);
  if (!primitives || !extent) {
    return '';
  }
  return `<filter id="${filterId(paint.id)}" filterUnits="userSpaceOnUse" x="${round(extent.left)}" y="${round(extent.top)}" width="${round(extent.right - extent.left)}" height="${round(extent.bottom - extent.top)}" color-interpolation-filters="sRGB">${primitives}</filter>`;
}

const NO_ASSET = () => null;

const matrixAttr = (m: Layer['matrix']) => (m.every((n, i) => n === IDENTITY[i]) ? '' : ` transform="matrix(${m.map(round).join(' ')})"`);
const opacityAttr = (o: number) => (o === 1 ? '' : ` opacity="${round(o)}"`);

export function shapeMarkup(p: ShapeLook, paint: Paint): string {
  return shapeDrawing(p, paint).markup;
}

export function shapeDrawing(p: ShapeLook, paint: Paint): { markup: string; extent: Extent | null } {
  const layers = shapeLayers(p, paint.size, paint.time).filter((l) => l.outline.length);
  const paths = layers.map((l) => `<path d="${pathData(l.outline)}"${matrixAttr(l.matrix)}${opacityAttr(l.opacity)}/>`).join('');
  const ownFill = FILL_OUTLINE[p.shape]?.(p, paint.size);
  const fillPaths = ownFill ? (ownFill.length ? `<path d="${pathData(ownFill)}"/>` : '') : paths;
  const extent = paintedExtent(p, paint, layers);
  const filter = filterOf(p, paint, extent);
  const fills = fillPaths ? svgFills(fillsOf(p), { id: paint.id, size: paint.size, color: paint.color, asset: paint.asset ?? NO_ASSET }, fillPaths, p.fillRule) : { defs: '', body: '' };
  const strokes = svgStrokes(strokesOf(p), paint, paths, { sided: SIDED[p.shape] });
  const inner = fills.defs + strokes.defs + filter;
  const defs = inner ? `<defs>${inner}</defs>` : '';
  const filtered = filter ? ` filter="url(#${filterId(paint.id)})"` : '';
  return { markup: `${defs}<g${filtered}>${fills.body}${strokes.body}</g>`, extent };
}
