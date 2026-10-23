import type { ColorStop, Effect, FigmaMessage, FigmaRawNode, Guid, Matrix, Paint, Rgba, Vec } from './archive';
import { geometryPath } from './commands';
import { FillRule, networkPath } from './vector-network';

export enum LayerKind {
  Frame = 'frame',
  Shape = 'shape',
  Text = 'text'
}

export enum FillKind {
  Solid = 'solid',
  Linear = 'linear',
  Radial = 'radial',
  Image = 'image'
}

export enum Clip {
  Content = 'clip',
  None = 'none'
}

export type Box = { x: number; y: number; width: number; height: number };
export type Stop = { color: string; pos: number };

export type Fill =
  | { kind: FillKind.Solid; color: string; opacity: number }
  | { kind: FillKind.Linear; stops: Stop[]; angle: number; opacity: number }
  | { kind: FillKind.Radial; stops: Stop[]; opacity: number }
  | { kind: FillKind.Image; hash: string; opacity: number };

export type Stroke = { color: string; weight: number; align: string };

export type Shadow = { kind: 'drop-shadow' | 'inner-shadow'; x: number; y: number; blur: number; spread: number; color: string; opacity: number };
export type Blur = { kind: 'layer-blur' | 'background-blur'; radius: number };
export type LayerEffect = Shadow | Blur;

export type AutoLayout = { direction: 'row' | 'column'; gap: number; padding: [number, number, number, number] };

export type TextRun = { start: number; end: number; font?: string; weight?: number; size?: number; color?: string; italic?: boolean };

type Common = { name: string; box: Box; opacity: number; effects: LayerEffect[] };

export type FrameLayer = Common & { kind: LayerKind.Frame; fills: Fill[]; strokes: Stroke[]; radii: [number, number, number, number]; clip: Clip; autoLayout: AutoLayout | null; children: Layer[] };
export type ShapeLayer = Common & { kind: LayerKind.Shape; path: string; fillRule: FillRule; fills: Fill[]; strokes: Stroke[] };
export type TextLayer = Common & {
  kind: LayerKind.Text;
  text: string;
  font: string;
  weight: number;
  italic: boolean;
  size: number;
  lineHeight: string;
  letterSpacing: string;
  align: 'left' | 'center' | 'right' | 'justify';
  color: string;
  runs: TextRun[];
};
export type Layer = FrameLayer | ShapeLayer | TextLayer;

export type FigmaScene = { root: FrameLayer; skipped: string[] };

const IDENTITY: Matrix = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
const DIGITS = 100;
const KAPPA = 0.5522847498;
const PERCENT = 100;

const CONTAINERS = new Set(['FRAME', 'GROUP', 'SECTION', 'INSTANCE', 'SYMBOL', 'COMPONENT', 'COMPONENT_SET']);
const VECTORS = new Set(['VECTOR', 'STAR', 'REGULAR_POLYGON', 'LINE', 'BOOLEAN_OPERATION']);
const PAGES = new Set(['DOCUMENT', 'CANVAS']);

const WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra ?light|ultra ?light/i, 200],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi ?bold|demi ?bold/i, 600],
  [/extra ?bold|ultra ?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700]
];
const REGULAR = 400;

const ALIGN: Record<string, TextLayer['align']> = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' };

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const keyOf = (g: Guid) => `${g.sessionID}:${g.localID}`;
const channel = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');

export const hexOf = (c: Rgba) => `#${channel(c.r)}${channel(c.g)}${channel(c.b)}`;

export const weightOf = (style: string) => WEIGHTS.find(([re]) => re.test(style))?.[1] ?? REGULAR;

const hashHex = (hash: Uint8Array | undefined) => Array.from(hash ?? [], (b) => b.toString(16).padStart(2, '0')).join('');

const multiply = (a: Matrix, b: Matrix): Matrix => ({
  m00: a.m00 * b.m00 + a.m01 * b.m10,
  m01: a.m00 * b.m01 + a.m01 * b.m11,
  m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
  m10: a.m10 * b.m00 + a.m11 * b.m10,
  m11: a.m10 * b.m01 + a.m11 * b.m11,
  m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12
});

const applied = (m: Matrix, p: Vec): Vec => ({ x: m.m00 * p.x + m.m01 * p.y + m.m02, y: m.m10 * p.x + m.m11 * p.y + m.m12 });

const rotated = (m: Matrix) => Math.abs(m.m01) > 1e-6 || Math.abs(m.m10) > 1e-6;

const boxOf = (m: Matrix, size: Vec): Box => ({ x: round(m.m02), y: round(m.m12), width: round(size.x), height: round(size.y) });

function transformedPath(path: string, m: Matrix): string {
  const numbers = path.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const letters = path.match(/[MLCQZ]/gi) ?? [];
  const arity: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };
  let n = 0;
  return letters
    .map((letter) => {
      const count = arity[letter.toUpperCase()];
      const pts: string[] = [];
      for (let i = 0; i < count; i += 2) {
        const p = applied(m, { x: Number(numbers[n + i]), y: Number(numbers[n + i + 1]) });
        pts.push(`${round(p.x)} ${round(p.y)}`);
      }
      n += count;
      return `${letter.toUpperCase()}${pts.join(' ')}`;
    })
    .join(' ');
}

function roundedRect(size: Vec, radii: [number, number, number, number]): string {
  const [w, h] = [size.x, size.y];
  const cap = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = radii.map((r) => Math.min(r, cap));
  const k = (r: number) => r * (1 - KAPPA);
  return [
    `M${tl} 0`,
    `L${w - tr} 0`,
    tr ? `C${w - k(tr)} 0 ${w} ${k(tr)} ${w} ${tr}` : '',
    `L${w} ${h - br}`,
    br ? `C${w} ${h - k(br)} ${w - k(br)} ${h} ${w - br} ${h}` : '',
    `L${bl} ${h}`,
    bl ? `C${k(bl)} ${h} 0 ${h - k(bl)} 0 ${h - bl}` : '',
    `L0 ${tl}`,
    tl ? `C0 ${k(tl)} ${k(tl)} 0 ${tl} 0` : '',
    'Z'
  ]
    .filter(Boolean)
    .join(' ');
}

function ellipse(size: Vec): string {
  const [rx, ry] = [size.x / 2, size.y / 2];
  const [kx, ky] = [rx * KAPPA, ry * KAPPA];
  return `M${rx} 0 C${rx + kx} 0 ${size.x} ${ry - ky} ${size.x} ${ry} C${size.x} ${ry + ky} ${rx + kx} ${size.y} ${rx} ${size.y} C${rx - kx} ${size.y} 0 ${ry + ky} 0 ${ry} C0 ${ry - ky} ${rx - kx} 0 ${rx} 0 Z`;
}

function radiiOf(n: FigmaRawNode): [number, number, number, number] {
  const all = n.cornerRadius ?? 0;
  if (!n.rectangleCornerRadiiIndependent) {
    return [all, all, all, all];
  }
  return [n.rectangleTopLeftCornerRadius ?? all, n.rectangleTopRightCornerRadius ?? all, n.rectangleBottomRightCornerRadius ?? all, n.rectangleBottomLeftCornerRadius ?? all];
}

const stopsOf = (stops: ColorStop[] = []): Stop[] => stops.map((s) => ({ color: hexOf(s.color), pos: round(s.position) }));

function gradientAngle(t: Matrix | undefined): number {
  const m = t ?? IDENTITY;
  const det = m.m00 * m.m11 - m.m01 * m.m10 || 1;
  const dx = m.m11 / det;
  const dy = -m.m10 / det;
  return Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360);
}

type Report = (what: string) => void;

const FILLS: Record<string, (p: Paint, report: Report) => Fill | null> = {
  SOLID: (p) => ({ kind: FillKind.Solid, color: hexOf(p.color!), opacity: round((p.opacity ?? 1) * (p.color?.a ?? 1)) }),
  GRADIENT_LINEAR: (p) => ({ kind: FillKind.Linear, stops: stopsOf(p.stops), angle: gradientAngle(p.transform), opacity: round(p.opacity ?? 1) }),
  GRADIENT_RADIAL: (p) => ({ kind: FillKind.Radial, stops: stopsOf(p.stops), opacity: round(p.opacity ?? 1) }),
  GRADIENT_DIAMOND: (p, report) => (report('diamond gradient drawn as radial'), { kind: FillKind.Radial, stops: stopsOf(p.stops), opacity: round(p.opacity ?? 1) }),
  GRADIENT_ANGULAR: (p, report) => (report('angular gradient drawn as linear'), { kind: FillKind.Linear, stops: stopsOf(p.stops), angle: gradientAngle(p.transform), opacity: round(p.opacity ?? 1) }),
  IMAGE: (p, report) => {
    const hash = hashHex(p.image?.hash);
    report(`image ${hash.slice(0, 12)} placed as a placeholder`);
    return { kind: FillKind.Image, hash, opacity: round(p.opacity ?? 1) };
  }
};

function fillsOf(paints: Paint[] | undefined, report: Report): Fill[] {
  return (paints ?? [])
    .filter((p) => p.visible !== false)
    .flatMap((p) => {
      const made = FILLS[p.type]?.(p, report);
      if (made === undefined) {
        report(`${p.type.toLowerCase()} paint`);
      }
      return made ? [made] : [];
    });
}

function strokesOf(n: FigmaRawNode, report: Report): Stroke[] {
  return fillsOf(n.strokePaints, report).flatMap((f) => (f.kind === FillKind.Solid ? [{ color: f.color, weight: round(n.strokeWeight ?? 1), align: (n.strokeAlign ?? 'CENTER').toLowerCase() }] : (report('gradient stroke drawn solid'), [])));
}

const EFFECTS: Record<string, (e: Effect) => LayerEffect> = {
  DROP_SHADOW: (e) => ({ kind: 'drop-shadow', x: round(e.offset?.x ?? 0), y: round(e.offset?.y ?? 0), blur: round(e.radius ?? 0), spread: round(e.spread ?? 0), color: hexOf(e.color!), opacity: round(e.color?.a ?? 1) }),
  INNER_SHADOW: (e) => ({ kind: 'inner-shadow', x: round(e.offset?.x ?? 0), y: round(e.offset?.y ?? 0), blur: round(e.radius ?? 0), spread: round(e.spread ?? 0), color: hexOf(e.color!), opacity: round(e.color?.a ?? 1) }),
  FOREGROUND_BLUR: (e) => ({ kind: 'layer-blur', radius: round(e.radius ?? 0) }),
  BACKGROUND_BLUR: (e) => ({ kind: 'background-blur', radius: round(e.radius ?? 0) })
};

function effectsOf(n: FigmaRawNode, report: Report): LayerEffect[] {
  return (n.effects ?? [])
    .filter((e) => e.visible !== false)
    .flatMap((e) => {
      const made = EFFECTS[e.type];
      if (!made) {
        report(`${e.type.toLowerCase()} effect`);
      }
      return made ? [made(e)] : [];
    });
}

function autoLayoutOf(n: FigmaRawNode): AutoLayout | null {
  if (!n.stackMode || n.stackMode === 'NONE') {
    return null;
  }
  const [h, v] = [n.stackHorizontalPadding ?? 0, n.stackVerticalPadding ?? 0];
  return { direction: n.stackMode === 'HORIZONTAL' ? 'row' : 'column', gap: n.stackSpacing ?? 0, padding: [v, n.stackPaddingRight ?? h, n.stackPaddingBottom ?? v, h] };
}

function runsOf(n: FigmaRawNode, base: { font: string; weight: number; size: number; color: string }, report: Report): TextRun[] {
  const ids = n.textData?.characterStyleIDs ?? [];
  const table = new Map((n.textData?.styleOverrideTable ?? []).map((s) => [s.styleID ?? 0, s]));
  const runs: TextRun[] = [];
  let start = 0;
  for (let i = 1; i <= ids.length; i++) {
    if (i < ids.length && ids[i] === ids[start]) {
      continue;
    }
    const style = table.get(ids[start]);
    if (ids[start] && style) {
      const fill = fillsOf(style.fillPaints, report).find((f) => f.kind === FillKind.Solid);
      const run: TextRun = { start, end: i };
      if (style.fontName && style.fontName.family !== base.font) {
        run.font = style.fontName.family;
      }
      if (style.fontName && weightOf(style.fontName.style) !== base.weight) {
        run.weight = weightOf(style.fontName.style);
      }
      if (style.fontName && /italic/i.test(style.fontName.style)) {
        run.italic = true;
      }
      if (style.fontSize && style.fontSize !== base.size) {
        run.size = style.fontSize;
      }
      if (fill && fill.color !== base.color) {
        run.color = fill.color;
      }
      if (Object.keys(run).length > 2) {
        runs.push(run);
      }
    }
    start = i;
  }
  return runs;
}

const UNIT_SUFFIX: Record<string, (v: number) => string> = { PIXELS: (v) => `${round(v)}px`, PERCENT: (v) => `${round(v)}%`, RAW: (v) => `${round(v * PERCENT)}%` };

const unitOf = (u: { value: number; units: string } | undefined, fallback: string) => (u && UNIT_SUFFIX[u.units] ? UNIT_SUFFIX[u.units](u.value) : fallback);

type Ctx = { byKey: Map<string, FigmaRawNode>; children: Map<string, FigmaRawNode[]>; blobs: Uint8Array[]; report: Report };

function shapePath(n: FigmaRawNode, ctx: Ctx): { path: string; rule: FillRule } {
  const size = n.size ?? { x: 0, y: 0 };
  if (n.type === 'RECTANGLE' || n.type === 'ROUNDED_RECTANGLE') {
    return { path: roundedRect(size, radiiOf(n)), rule: FillRule.NonZero };
  }
  if (n.type === 'ELLIPSE') {
    return { path: ellipse(size), rule: FillRule.NonZero };
  }
  const blob = n.vectorData?.vectorNetworkBlob;
  const normal = n.vectorData?.normalizedSize;
  if (blob !== undefined && ctx.blobs[blob] && normal) {
    return networkPath(ctx.blobs[blob], { x: normal.x ? size.x / normal.x : 1, y: normal.y ? size.y / normal.y : 1 });
  }
  const geometry = n.fillGeometry?.[0]?.commandsBlob ?? n.strokeGeometry?.[0]?.commandsBlob;
  return { path: geometry !== undefined && ctx.blobs[geometry] ? geometryPath(ctx.blobs[geometry]) : '', rule: FillRule.NonZero };
}

function common(n: FigmaRawNode, m: Matrix, ctx: Ctx): Common {
  return { name: n.name ?? n.type ?? '', box: boxOf(m, n.size ?? { x: 0, y: 0 }), opacity: round(n.opacity ?? 1), effects: effectsOf(n, ctx.report) };
}

function textLayer(n: FigmaRawNode, m: Matrix, ctx: Ctx): TextLayer {
  const font = n.fontName?.family ?? 'Inter';
  const weight = weightOf(n.fontName?.style ?? '');
  const size = n.fontSize ?? 12;
  const color = fillsOf(n.fillPaints, ctx.report).find((f) => f.kind === FillKind.Solid);
  const base = { font, weight, size, color: color?.kind === FillKind.Solid ? color.color : '#000000' };
  return {
    kind: LayerKind.Text,
    ...common(n, m, ctx),
    text: n.textData?.characters ?? '',
    ...base,
    italic: /italic/i.test(n.fontName?.style ?? ''),
    lineHeight: unitOf(n.lineHeight, 'auto'),
    letterSpacing: unitOf(n.letterSpacing, '0%'),
    align: ALIGN[n.textAlignHorizontal ?? 'LEFT'] ?? 'left',
    runs: runsOf(n, base, ctx.report)
  };
}

function childrenOf(n: FigmaRawNode, ctx: Ctx): FigmaRawNode[] {
  const own = ctx.children.get(keyOf(n.guid)) ?? [];
  if (own.length || n.type !== 'INSTANCE' || !n.symbolData?.symbolID) {
    return own;
  }
  const symbol = ctx.byKey.get(keyOf(n.symbolData.symbolID));
  if (!symbol) {
    ctx.report(`component of instance ${n.name ?? ''} not in the clipboard`);
    return [];
  }
  ctx.report(`instance ${n.name ?? ''} flattened, overrides ignored`);
  return ctx.children.get(keyOf(symbol.guid)) ?? [];
}

function layerOf(n: FigmaRawNode, parent: Matrix, ctx: Ctx): Layer | null {
  if (n.visible === false) {
    return null;
  }
  const m = multiply(parent, n.transform ?? IDENTITY);
  const type = n.type ?? '';
  if (CONTAINERS.has(type)) {
    return frameLayer(n, m, ctx);
  }
  if (rotated(m) && type === 'TEXT') {
    ctx.report(`rotation of text ${n.name ?? ''}`);
  }
  if (type === 'TEXT') {
    return textLayer(n, m, ctx);
  }
  if (VECTORS.has(type) || type === 'RECTANGLE' || type === 'ROUNDED_RECTANGLE' || type === 'ELLIPSE') {
    const local = shapePath(n, ctx);
    if (!local.path) {
      ctx.report(`${type.toLowerCase()} ${n.name ?? ''} without geometry`);
      return null;
    }
    return { kind: LayerKind.Shape, ...common(n, m, ctx), path: transformedPath(local.path, m), fillRule: local.rule, fills: fillsOf(n.fillPaints, ctx.report), strokes: strokesOf(n, ctx.report) };
  }
  ctx.report(`${type.toLowerCase()} ${n.name ?? ''}`);
  return null;
}

function frameLayer(n: FigmaRawNode, m: Matrix, ctx: Ctx): FrameLayer {
  if (rotated(m)) {
    ctx.report(`rotation of frame ${n.name ?? ''}`);
  }
  const autoLayout = autoLayoutOf(n);
  if (autoLayout) {
    ctx.report(`auto layout of ${n.name ?? ''} kept as fixed positions`);
  }
  const clips = n.type !== 'GROUP' && !n.resizeToFit && n.frameMaskDisabled === false;
  return {
    kind: LayerKind.Frame,
    ...common(n, m, ctx),
    fills: fillsOf(n.fillPaints, ctx.report),
    strokes: strokesOf(n, ctx.report),
    radii: radiiOf(n),
    clip: clips ? Clip.Content : Clip.None,
    autoLayout,
    children: childrenOf(n, ctx).flatMap((c) => layerOf(c, m, ctx) ?? [])
  };
}

const byPosition = (a: FigmaRawNode, b: FigmaRawNode) => ((a.parentIndex?.position ?? '') < (b.parentIndex?.position ?? '') ? -1 : 1);

function boundsOf(layers: Layer[]): Box {
  const xs = layers.flatMap((l) => [l.box.x, l.box.x + l.box.width]);
  const ys = layers.flatMap((l) => [l.box.y, l.box.y + l.box.height]);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const shifted = (m: Matrix, by: Vec): Matrix => ({ ...m, m02: m.m02 - by.x, m12: m.m12 - by.y });

export function figmaScene(message: FigmaMessage): FigmaScene | null {
  const skipped = new Set<string>();
  const byKey = new Map(message.nodes.map((n) => [keyOf(n.guid), n]));
  const children = new Map<string, FigmaRawNode[]>();
  for (const n of message.nodes) {
    const parent = n.parentIndex ? keyOf(n.parentIndex.guid) : null;
    if (parent) {
      children.set(parent, [...(children.get(parent) ?? []), n]);
    }
  }
  for (const list of children.values()) {
    list.sort(byPosition);
  }
  const ctx: Ctx = { byKey, children, blobs: message.blobs, report: (what) => skipped.add(what.trim()) };
  const internal = new Set(message.nodes.filter((n) => n.type === 'CANVAS' && n.internalOnly).map((n) => keyOf(n.guid)));
  const tops = message.nodes.filter((n) => !PAGES.has(n.type ?? '') && n.parentIndex && PAGES.has(byKey.get(keyOf(n.parentIndex.guid))?.type ?? '') && !internal.has(keyOf(n.parentIndex.guid))).sort(byPosition);
  if (!tops.length) {
    return null;
  }
  const single = tops.length === 1 && CONTAINERS.has(tops[0].type ?? '') ? tops[0] : null;
  if (single) {
    const at = single.transform ?? IDENTITY;
    const root = frameLayer(single, shifted(at, { x: at.m02, y: at.m12 }), ctx);
    return { root: { ...root, clip: Clip.Content }, skipped: [...skipped] };
  }
  const placed = tops.flatMap((n) => layerOf(n, IDENTITY, ctx) ?? []);
  if (!placed.length) {
    return null;
  }
  const box = boundsOf(placed);
  const again = tops.flatMap((n) => layerOf(n, shifted(IDENTITY, box), ctx) ?? []);
  const root: FrameLayer = { kind: LayerKind.Frame, name: 'Figma paste', box: { ...box, x: 0, y: 0 }, opacity: 1, effects: [], fills: [], strokes: [], radii: [0, 0, 0, 0], clip: Clip.None, autoLayout: null, children: again };
  return { root, skipped: [...skipped] };
}
