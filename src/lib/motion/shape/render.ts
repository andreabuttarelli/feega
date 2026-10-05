import { ellipseOutline, parsePath, pathData, polygonOutline, rectOutline, scaled, starOutline, type Outline, type Size } from './geometry';
import { morphOutline } from './morph';
import { IDENTITY, applyModifiers, modifierFilter, type AppliedModifier, type Layer } from './modifiers';
import { FillKind, ShapeKind, StrokeKind, modifierValues, type Modifier } from './schema';

export type ShapeLook = {
  shape: ShapeKind;
  path: string;
  roundness: number;
  sides: number;
  points: number;
  innerRadius: number;
  morphs: string[];
  morph: number;
  morphStart: number;
  modifiers: Modifier[];
  fillKind: FillKind;
  fill: string;
  fill2: string;
  gradientAngle: number;
  fillRule: string;
  strokeKind: StrokeKind;
  stroke: string;
  strokeWidth: number;
  dash: number;
  gap: number;
  cap: string;
  join: string;
};

export type Paint = { id: string; size: Size; unit: number; time: number; color: (value: string) => string };

const DIGITS = 1000;
const round = (n: number) => Math.round(n * DIGITS) / DIGITS;

export function pathOutline(d: string, size: Size): Outline {
  const outline = d ? parsePath(d) : [];
  return typeof outline === 'string' ? [] : scaled(outline, size);
}

const OUTLINE: Record<ShapeKind, (p: ShapeLook, size: Size) => Outline> = {
  [ShapeKind.Rect]: (p, size) => rectOutline(p.roundness, size),
  [ShapeKind.Line]: (_p, size) => rectOutline(0, size),
  [ShapeKind.Circle]: (_p, size) => ellipseOutline(size),
  [ShapeKind.Ellipse]: (_p, size) => ellipseOutline(size),
  [ShapeKind.Polygon]: (p, size) => polygonOutline(p.sides, p.roundness, size),
  [ShapeKind.Star]: (p, size) => starOutline(p.points, p.innerRadius, p.roundness, size),
  [ShapeKind.Path]: (p, size) => pathOutline(p.path, size)
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

const gradientId = (id: string) => `sg-${id}`;
const filterId = (id: string) => `sf-${id}`;
const FILTER_REACH = 3;

function filterOf(p: ShapeLook, paint: Paint): string {
  const primitives = modifierFilter(stackOf(p), paint.unit);
  if (!primitives) {
    return '';
  }
  const { w, h } = paint.size;
  return `<filter id="${filterId(paint.id)}" filterUnits="userSpaceOnUse" x="${round(-w * FILTER_REACH)}" y="${round(-h * FILTER_REACH)}" width="${round(w * (FILTER_REACH * 2 + 1))}" height="${round(h * (FILTER_REACH * 2 + 1))}" color-interpolation-filters="sRGB">${primitives}</filter>`;
}

function gradient(p: ShapeLook, paint: Paint): string {
  const { w, h } = paint.size;
  const stops = `<stop offset="0" style="stop-color:${paint.color(p.fill)}"/><stop offset="1" style="stop-color:${paint.color(p.fill2)}"/>`;
  if (p.fillKind === FillKind.Radial) {
    return `<radialGradient id="${gradientId(paint.id)}" gradientUnits="userSpaceOnUse" cx="${round(w / 2)}" cy="${round(h / 2)}" r="${round(Math.max(w, h) / 2)}">${stops}</radialGradient>`;
  }
  const r = (p.gradientAngle * Math.PI) / 180;
  const dx = (Math.cos(r) * w) / 2;
  const dy = (Math.sin(r) * h) / 2;
  return `<linearGradient id="${gradientId(paint.id)}" gradientUnits="userSpaceOnUse" x1="${round(w / 2 - dx)}" y1="${round(h / 2 - dy)}" x2="${round(w / 2 + dx)}" y2="${round(h / 2 + dy)}">${stops}</linearGradient>`;
}

const FILL: Record<FillKind, (p: ShapeLook, paint: Paint) => string> = {
  [FillKind.Solid]: (p, paint) => paint.color(p.fill),
  [FillKind.Linear]: (_p, paint) => `url(#${gradientId(paint.id)})`,
  [FillKind.Radial]: (_p, paint) => `url(#${gradientId(paint.id)})`,
  [FillKind.None]: () => 'none'
};

const STROKE: Record<StrokeKind, (p: ShapeLook, paint: Paint) => string> = {
  [StrokeKind.None]: () => 'none',
  [StrokeKind.Solid]: (p, paint) => paint.color(p.stroke),
  [StrokeKind.Gradient]: (_p, paint) => `url(#${gradientId(paint.id)})`
};

const usesGradient = (p: ShapeLook) => p.fillKind === FillKind.Linear || p.fillKind === FillKind.Radial || p.strokeKind === StrokeKind.Gradient;

function paintStyle(p: ShapeLook, paint: Paint): string {
  const stroke = STROKE[p.strokeKind](p, paint);
  const dashed = p.dash > 0 ? `;stroke-dasharray:${round(p.dash * paint.unit)} ${round((p.gap || p.dash) * paint.unit)}` : '';
  const line = stroke === 'none' ? '' : `;stroke-width:${round(p.strokeWidth * paint.unit)};stroke-linecap:${p.cap};stroke-linejoin:${p.join}${dashed}`;
  return `fill:${FILL[p.fillKind](p, paint)};fill-rule:${p.fillRule};stroke:${stroke}${line}`;
}

const matrixAttr = (m: Layer['matrix']) => (m.every((n, i) => n === IDENTITY[i]) ? '' : ` transform="matrix(${m.map(round).join(' ')})"`);
const opacityAttr = (o: number) => (o === 1 ? '' : ` opacity="${round(o)}"`);

export function shapeMarkup(p: ShapeLook, paint: Paint): string {
  const paths = shapeLayers(p, paint.size, paint.time)
    .filter((l) => l.outline.length)
    .map((l) => `<path d="${pathData(l.outline)}"${matrixAttr(l.matrix)}${opacityAttr(l.opacity)}/>`)
    .join('');
  const filter = filterOf(p, paint);
  const defs = usesGradient(p) || filter ? `<defs>${usesGradient(p) ? gradient(p, paint) : ''}${filter}</defs>` : '';
  const filtered = filter ? ` filter="url(#${filterId(paint.id)})"` : '';
  return `${defs}<g style="${paintStyle(p, paint)}"${filtered}>${paths}</g>`;
}
