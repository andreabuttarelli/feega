import { FillType, type Fill, type FillOf } from '../fill/model';
import { blendStyle, opacityAttr, svgPaint, type FillPaint } from '../fill/render';
import { StrokeAlign, type Stroke } from './model';

export type StrokePaint = Omit<FillPaint, 'asset'> & { unit: number };
export type StrokeShape = { sided: boolean };

const DIGITS = 1000;
const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const MITER_REACH = 4;
const HIDDEN = '#000000';
const SHOWN = '#ffffff';
const NOT_SIDED: StrokeShape = { sided: false };

const maskId = (id: string, i: number) => `sk-${id}-s${i}`;

type Aligned = {
  stretch: number;
  outer: number;
  inner: number;
  def: (id: string, paths: string, size: FillPaint['size']) => string;
  attr: (id: string) => string;
};

const ALIGN: Record<StrokeAlign, Aligned> = {
  [StrokeAlign.Center]: { stretch: 1, outer: 0.5, inner: 0.5, def: () => '', attr: () => '' },
  [StrokeAlign.Inside]: {
    stretch: 2,
    outer: 0,
    inner: 1,
    def: (id, paths) => `<clipPath id="${id}">${paths}</clipPath>`,
    attr: (id) => ` clip-path="url(#${id})"`
  },
  [StrokeAlign.Outside]: {
    stretch: 2,
    outer: 1,
    inner: 0,
    def: (id, paths, { w, h }) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="${-w}" y="${-h}" width="${w * 3}" height="${h * 3}"><rect x="${-w}" y="${-h}" width="${w * 3}" height="${h * 3}" style="fill:${SHOWN}"/><g style="fill:${HIDDEN};stroke:none">${paths}</g></mask>`,
    attr: (id) => ` mask="url(#${id})"`
  }
};

type Painted = FillOf<FillType.Solid | FillType.Linear | FillType.Radial>;

const look = (s: Stroke) => `${opacityAttr(s.paint)}`;
const blended = (s: Stroke) => blendStyle(s.paint);

function line(s: Stroke, colour: string, paint: StrokePaint, id: string, paths: string): { def: string; body: string } {
  const a = ALIGN[s.align];
  const dashed = s.dash > 0 ? `;stroke-dasharray:${round(s.dash * paint.unit)} ${round((s.gap || s.dash) * paint.unit)}` : '';
  const style = `fill:none;stroke:${colour};stroke-width:${round(s.width * paint.unit * a.stretch)};stroke-linecap:${s.cap};stroke-linejoin:${s.join}${dashed}${blended(s)}`;
  return { def: a.def(id, paths, paint.size), body: `<g style="${style}"${look(s)}${a.attr(id)}>${paths}</g>` };
}

const box = (l: number, t: number, r: number, b: number) => `M${round(l)} ${round(t)}H${round(r)}V${round(b)}H${round(l)}Z`;

function frame(s: Stroke, colour: string, paint: StrokePaint): { def: string; body: string } {
  const a = ALIGN[s.align];
  const [top, right, bottom, left] = s.sides!.map((n) => n * paint.unit);
  const { w, h } = paint.size;
  const outer = box(-left * a.outer, -top * a.outer, w + right * a.outer, h + bottom * a.outer);
  const inner = box(left * a.inner, top * a.inner, w - right * a.inner, h - bottom * a.inner);
  return { def: '', body: `<path d="${outer} ${inner}" style="fill:${colour};fill-rule:evenodd;stroke:none${blended(s)}"${look(s)}/>` };
}

export function svgStrokes(strokes: readonly Stroke[], paint: StrokePaint, paths: string, shape: StrokeShape = NOT_SIDED): { defs: string; body: string } {
  const own = { ...paint, id: `${paint.id}-s`, asset: () => null };
  const drawn = strokes.map((s, i) => {
    if (!s.visible) {
      return { def: '', body: '' };
    }
    const { def: gradient, fill } = svgPaint(s.paint as Painted, own, i);
    const layer = shape.sided && s.sides ? frame(s, fill, paint) : line(s, fill, paint, maskId(paint.id, i), paths);
    return { def: gradient + layer.def, body: layer.body };
  });
  return { defs: drawn.map((d) => d.def).join(''), body: drawn.map((d) => d.body).join('') };
}

export function strokeReach(strokes: readonly Stroke[], unit: number): number {
  const widest = Math.max(0, ...strokes.filter((s) => s.visible).map((s) => Math.max(s.width, ...(s.sides ?? [])) * ALIGN[s.align].outer));
  return widest * unit * MITER_REACH;
}

const TEXT_ALIGN: Record<StrokeAlign, { stretch: number; order?: string }> = {
  [StrokeAlign.Center]: { stretch: 1 },
  [StrokeAlign.Inside]: { stretch: 1 },
  [StrokeAlign.Outside]: { stretch: 2, order: 'stroke fill' }
};

export const firstColour = (f: Fill): string => (f.type === FillType.Solid ? f.color : f.type === FillType.Image ? HIDDEN : f.stops[0].color);

export function textStroke(strokes: readonly Stroke[], unit: number, color: (value: string) => string): Record<string, string> {
  const s = strokes.find((x) => x.visible && x.width > 0);
  if (!s) {
    return {};
  }
  const a = TEXT_ALIGN[s.align];
  return { WebkitTextStroke: `${round(s.width * unit * a.stretch)}px ${color(firstColour(s.paint))}`, ...(a.order ? { paintOrder: a.order } : {}) };
}
