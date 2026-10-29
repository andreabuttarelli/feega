import type { ColorStop, Effect, FigmaMessage, FigmaRawNode, Guid, Matrix, NodePatch, Paint, Rgba, Vec } from './archive';
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
  Angular = 'angular',
  Diamond = 'diamond',
  Image = 'image'
}

export enum Destination {
  Frame = 'frame',
  Free = 'free'
}

export enum Flow {
  Row = 'row',
  Column = 'column'
}

export enum Justify {
  Start = 'start',
  Center = 'center',
  End = 'end',
  SpaceBetween = 'space-between',
  SpaceAround = 'space-around',
  SpaceEvenly = 'space-evenly'
}

export enum Cross {
  Start = 'start',
  Center = 'center',
  End = 'end',
  Baseline = 'baseline'
}

export enum Fit {
  Fixed = 'fixed',
  Hug = 'hug'
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
  | { kind: FillKind.Angular; stops: Stop[]; angle: number; center: { x: number; y: number }; opacity: number }
  | { kind: FillKind.Diamond; stops: Stop[]; opacity: number }
  | { kind: FillKind.Image; hash: string; opacity: number };

export type Stroke = { fill: Fill; weight: number; align: string };

export type Shadow = { kind: 'drop-shadow' | 'inner-shadow'; x: number; y: number; blur: number; spread: number; color: string; opacity: number };
export type Blur = { kind: 'layer-blur' | 'background-blur'; radius: number };
export type LayerEffect = Shadow | Blur;

export type Padding = { top: number; right: number; bottom: number; left: number };
export type AutoLayout = { flow: Flow; wrap: boolean; gap: number; crossGap: number; padding: Padding; justify: Justify; align: Cross; width: Fit; height: Fit };
export type ChildItem = { grow: boolean; stretch: boolean; absolute: boolean };

export type TextRun = { start: number; end: number; font?: string; weight?: number; size?: number; color?: string; italic?: boolean };

type Common = { name: string; box: Box; rotation: number; opacity: number; effects: LayerEffect[]; item: ChildItem };

export type ComponentRef = { key: string; name: string; inPaste: boolean; variant?: Record<string, string> };

const VARIANT_NAME = /^(.+?) \/ ([^=,/]+=[^=,/]+(?:, [^=,/]+=[^=,/]+)*)$/;

function namedRef(name: string): Pick<ComponentRef, 'name' | 'variant'> {
  const found = name.match(VARIANT_NAME);
  if (!found) {
    return { name };
  }
  return { name: found[1], variant: Object.fromEntries(found[2].split(', ').map((pair) => pair.split('='))) };
}
export type FrameLayer = Common & { kind: LayerKind.Frame; component: ComponentRef | null; fills: Fill[]; strokes: Stroke[]; radii: [number, number, number, number]; outline: string; clip: Clip; autoLayout: AutoLayout | null; children: Layer[] };
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
  wraps: boolean;
  fills: Fill[];
  strokes: Stroke[];
};
export type Layer = FrameLayer | ShapeLayer | TextLayer;

export type Placement = { destination: Destination; layer: Layer; size: { width: number; height: number }; centre: Vec };
export type FigmaScene = { placements: Placement[]; combined: FrameLayer; skipped: string[] };

const IDENTITY: Matrix = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
const DIGITS = 100;
const KAPPA = 0.5522847498;
const PERCENT = 100;

const CONTAINERS = new Set(['FRAME', 'GROUP', 'SECTION', 'INSTANCE', 'SYMBOL', 'COMPONENT', 'COMPONENT_SET']);
const VECTORS = new Set(['VECTOR', 'STAR', 'REGULAR_POLYGON', 'LINE', 'BOOLEAN_OPERATION']);
const PAGES = new Set(['DOCUMENT', 'CANVAS']);

const DESTINATION: Record<string, Destination> = {
  FRAME: Destination.Frame,
  SECTION: Destination.Frame,
  COMPONENT: Destination.Frame,
  COMPONENT_SET: Destination.Frame,
  SYMBOL: Destination.Frame
};

const JUSTIFY: Record<string, Justify> = {
  MIN: Justify.Start,
  CENTER: Justify.Center,
  MAX: Justify.End,
  SPACE_EVENLY: Justify.SpaceBetween,
  SPACE_BETWEEN: Justify.SpaceBetween,
  SPACE_AROUND: Justify.SpaceAround,
  SPACE_EVENLY_CSS: Justify.SpaceEvenly
};

const CROSS: Record<string, Cross> = { MIN: Cross.Start, CENTER: Cross.Center, MAX: Cross.End, BASELINE: Cross.Baseline };

const HUGGING = new Set(['RESIZE_TO_FIT', 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE']);
const FLOWS: Record<string, Flow> = { HORIZONTAL: Flow.Row, VERTICAL: Flow.Column };
const HALF_TURN = 180;
const NO_ROTATION = 1e-3;

export const destinationOf = (type: string | undefined): Destination => DESTINATION[type ?? ''] ?? Destination.Free;

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

const rotationOf = (m: Matrix) => round((Math.atan2(m.m10, m.m00) * HALF_TURN) / Math.PI);

const isRotated = (m: Matrix) => Math.abs(rotationOf(m)) > NO_ROTATION;

function boxOf(m: Matrix, size: Vec): Box {
  const middle = applied(m, { x: size.x / 2, y: size.y / 2 });
  return { x: round(middle.x - size.x / 2), y: round(middle.y - size.y / 2), width: round(size.x), height: round(size.y) };
}

function pathBox(path: string): Box {
  const numbers = (path.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x: round(x), y: round(y), width: round(Math.max(...xs) - x), height: round(Math.max(...ys) - y) };
}

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

const QUARTER_TURN = 90;

function axisAngle(t: Matrix | undefined): number {
  const m = t ?? IDENTITY;
  const det = m.m00 * m.m11 - m.m01 * m.m10 || 1;
  return Math.round(((Math.atan2(-m.m10 / det, m.m11 / det) * 180) / Math.PI + 360) % 360);
}

const sweepAngle = (t: Matrix | undefined) => (axisAngle(t) + QUARTER_TURN) % 360;

const GRADIENT_MIDDLE = 0.5;
const unitClamp = (n: number) => round(Math.max(0, Math.min(1, n)));

function gradientCentre(t: Matrix | undefined): { x: number; y: number } {
  const m = t ?? IDENTITY;
  const det = m.m00 * m.m11 - m.m01 * m.m10 || 1;
  const [gx, gy] = [GRADIENT_MIDDLE - m.m02, GRADIENT_MIDDLE - m.m12];
  return { x: unitClamp((m.m11 * gx - m.m01 * gy) / det), y: unitClamp((m.m00 * gy - m.m10 * gx) / det) };
}

type Report = (what: string) => void;

const FILLS: Record<string, (p: Paint, report: Report) => Fill | null> = {
  SOLID: (p) => ({ kind: FillKind.Solid, color: hexOf(p.color!), opacity: round((p.opacity ?? 1) * (p.color?.a ?? 1)) }),
  GRADIENT_LINEAR: (p) => ({ kind: FillKind.Linear, stops: stopsOf(p.stops), angle: axisAngle(p.transform), opacity: round(p.opacity ?? 1) }),
  GRADIENT_RADIAL: (p) => ({ kind: FillKind.Radial, stops: stopsOf(p.stops), opacity: round(p.opacity ?? 1) }),
  GRADIENT_DIAMOND: (p) => ({ kind: FillKind.Diamond, stops: stopsOf(p.stops), opacity: round(p.opacity ?? 1) }),
  GRADIENT_ANGULAR: (p) => ({ kind: FillKind.Angular, stops: stopsOf(p.stops), angle: sweepAngle(p.transform), center: gradientCentre(p.transform), opacity: round(p.opacity ?? 1) }),
  IMAGE: (p) => ({ kind: FillKind.Image, hash: hashHex(p.image?.hash), opacity: round(p.opacity ?? 1) })
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

const STROKE_KINDS = new Set([FillKind.Solid, FillKind.Linear, FillKind.Radial, FillKind.Angular, FillKind.Diamond]);

function strokesOf(n: FigmaRawNode, report: Report): Stroke[] {
  return fillsOf(n.strokePaints, report).flatMap((fill) => {
    if (!STROKE_KINDS.has(fill.kind)) {
      report(`${fill.kind} stroke`);
      return [];
    }
    return [{ fill, weight: round(n.strokeWeight ?? 1), align: (n.strokeAlign ?? 'CENTER').toLowerCase() }];
  });
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

const hugs = (sizing: string | undefined) => HUGGING.has(sizing ?? '');

function autoLayoutOf(n: FigmaRawNode, report: Report): AutoLayout | null {
  const flow = FLOWS[n.stackMode ?? ''];
  if (!flow) {
    if (n.stackMode === 'GRID') {
      report(`grid layout of ${n.name ?? ''} kept as fixed positions`);
    }
    return null;
  }
  const left = n.stackHorizontalPadding ?? n.stackPadding ?? 0;
  const top = n.stackVerticalPadding ?? n.stackPadding ?? 0;
  const [primaryHugs, counterHugs] = [hugs(n.stackPrimarySizing), hugs(n.stackCounterSizing)];
  const row = flow === Flow.Row;
  return {
    flow,
    wrap: n.stackWrap === 'WRAP',
    gap: round(n.stackSpacing ?? 0),
    crossGap: round(n.stackCounterSpacing ?? n.stackSpacing ?? 0),
    padding: { top, right: n.stackPaddingRight ?? left, bottom: n.stackPaddingBottom ?? top, left },
    justify: JUSTIFY[n.stackPrimaryAlignItems ?? n.stackJustify ?? ''] ?? Justify.Start,
    align: CROSS[n.stackCounterAlignItems ?? n.stackCounterAlign ?? ''] ?? Cross.Start,
    width: (row ? primaryHugs : counterHugs) ? Fit.Hug : Fit.Fixed,
    height: (row ? counterHugs : primaryHugs) ? Fit.Hug : Fit.Fixed
  };
}

const itemOf = (n: FigmaRawNode): ChildItem => ({ grow: (n.stackChildPrimaryGrow ?? 0) > 0, stretch: n.stackChildAlignSelf === 'STRETCH', absolute: n.stackPositioning === 'ABSOLUTE' });

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
      if (positive(style.fontSize) && style.fontSize !== base.size) {
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

type Scope = { inside: boolean; trail: string[]; patches: Map<string, NodePatch[]> };

type Ctx = { byKey: Map<string, FigmaRawNode>; children: Map<string, FigmaRawNode[]>; blobs: Uint8Array[]; report: Report; scope: Scope };

const OUTSIDE: Scope = { inside: false, trail: [], patches: new Map() };
const PATH_SEPARATOR = '/';

function patchesIn(n: FigmaRawNode, prefix: string[]): Map<string, NodePatch[]> {
  const found = new Map<string, NodePatch[]>();
  for (const patch of [...(n.derivedSymbolData ?? []), ...(n.symbolData?.symbolOverrides ?? [])]) {
    const key = [...prefix, ...(patch.guidPath?.guids ?? []).map(keyOf)].join(PATH_SEPARATOR);
    found.set(key, [...(found.get(key) ?? []), patch]);
  }
  return found;
}

function mergedPatches(...maps: Map<string, NodePatch[]>[]): Map<string, NodePatch[]> {
  const out = new Map<string, NodePatch[]>();
  for (const map of maps) {
    for (const [key, list] of map) {
      out.set(key, [...(out.get(key) ?? []), ...list]);
    }
  }
  return out;
}

function withPatch(n: FigmaRawNode, patch: NodePatch): FigmaRawNode {
  const { guidPath: _path, overriddenSymbolID, textData, ...fields } = patch;
  const retyped = textData && textData.characters !== n.textData?.characters && !textData.characterStyleIDs;
  const merged = textData ? { ...n.textData, ...textData, ...(retyped ? { characterStyleIDs: [], styleOverrideTable: [] } : {}) } : n.textData;
  const swapped = overriddenSymbolID ? { symbolData: { ...n.symbolData, symbolID: overriddenSymbolID } } : {};
  return { ...n, ...fields, ...(merged ? { textData: merged } : {}), ...swapped };
}

function patchedNode(n: FigmaRawNode, ctx: Ctx): FigmaRawNode {
  if (!ctx.scope.inside) {
    return n;
  }
  const key = [...ctx.scope.trail, keyOf(n.guid)].join(PATH_SEPARATOR);
  return (ctx.scope.patches.get(key) ?? []).reduce(withPatch, n);
}

const hasOverrides = (n: FigmaRawNode, symbol: FigmaRawNode) =>
  Boolean(n.symbolData?.symbolOverrides?.length) || n.size?.x !== symbol.size?.x || n.size?.y !== symbol.size?.y;

function scopeOf(n: FigmaRawNode, ctx: Ctx, flattened: boolean): Ctx {
  const here = ctx.scope.inside ? [...ctx.scope.trail, keyOf(n.guid)] : [];
  if (flattened) {
    const own = patchesIn(n, here);
    return { ...ctx, scope: { inside: true, trail: here, patches: ctx.scope.inside ? mergedPatches(ctx.scope.patches, own) : own } };
  }
  return ctx.scope.inside ? { ...ctx, scope: { ...ctx.scope, trail: here } } : ctx;
}

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
  return { name: n.name ?? n.type ?? '', box: boxOf(m, n.size ?? { x: 0, y: 0 }), rotation: rotationOf(m), opacity: round(n.opacity ?? 1), effects: effectsOf(n, ctx.report), item: itemOf(n) };
}

const DEFAULT_TEXT_SIZE = 12;

const positive = (v: number | undefined): v is number => v !== undefined && v > 0;

const effectiveSize = (n: FigmaRawNode): number =>
  [n.fontSize, ...(n.textData?.styleOverrideTable ?? []).map((s) => s.fontSize)].find(positive) ?? DEFAULT_TEXT_SIZE;

function textLayer(n: FigmaRawNode, m: Matrix, ctx: Ctx): TextLayer {
  const font = n.fontName?.family ?? 'Inter';
  const weight = weightOf(n.fontName?.style ?? '');
  const size = effectiveSize(n);
  const fills = fillsOf(n.fillPaints, ctx.report);
  const color = fills.find((f) => f.kind === FillKind.Solid);
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
    runs: runsOf(n, base, ctx.report),
    wraps: n.textAutoResize === 'HEIGHT',
    fills,
    strokes: strokesOf(n, ctx.report)
  };
}

function childrenOf(n: FigmaRawNode, ctx: Ctx): { kids: FigmaRawNode[]; within: Ctx } {
  const own = ctx.children.get(keyOf(n.guid)) ?? [];
  if (own.length || n.type !== 'INSTANCE' || !n.symbolData?.symbolID) {
    return { kids: own, within: scopeOf(n, ctx, false) };
  }
  const symbol = ctx.byKey.get(keyOf(n.symbolData.symbolID));
  if (!symbol) {
    ctx.report(`component of instance ${n.name ?? ''} not in the clipboard`);
    return { kids: [], within: ctx };
  }
  return { kids: ctx.children.get(keyOf(symbol.guid)) ?? [], within: scopeOf(n, ctx, true) };
}

const PLACEHOLDER_FILL: Fill = { kind: FillKind.Solid, color: '#d9d9d9', opacity: 1 };

function placeholderOf(n: FigmaRawNode, m: Matrix, ctx: Ctx, note: string): Layer | null {
  const size = n.size ?? { x: 0, y: 0 };
  ctx.report(note);
  if (size.x <= 0 || size.y <= 0) {
    return null;
  }
  const path = transformedPath(roundedRect(size, [0, 0, 0, 0]), m);
  const shaped = common(n, m, ctx);
  const box = isRotated(m) ? pathBox(path) : shaped.box;
  return { kind: LayerKind.Shape, ...shaped, box, rotation: 0, path, fillRule: FillRule.NonZero, fills: [PLACEHOLDER_FILL], strokes: [] };
}

function componentOf(n: FigmaRawNode, ctx: Ctx): ComponentRef | null {
  const id = n.symbolData?.symbolID;
  if (n.type !== 'INSTANCE' || !id) {
    return null;
  }
  const main = ctx.byKey.get(keyOf(id));
  const linked = Boolean(main) && !hasOverrides(n, main!);
  return { key: keyOf(id), ...namedRef(main?.name ?? n.name ?? 'Component'), inPaste: linked };
}

function layerOf(raw: FigmaRawNode, parent: Matrix, ctx: Ctx): Layer | null {
  const n = patchedNode(raw, ctx);
  if (n.visible === false) {
    return null;
  }
  const m = multiply(parent, n.transform ?? IDENTITY);
  const type = n.type ?? '';
  if (CONTAINERS.has(type)) {
    return frameLayer(n, m, ctx);
  }
  if (type === 'TEXT') {
    return textLayer(n, m, ctx);
  }
  if (VECTORS.has(type) || type === 'RECTANGLE' || type === 'ROUNDED_RECTANGLE' || type === 'ELLIPSE') {
    const local = shapePath(n, ctx);
    if (!local.path) {
      return placeholderOf(n, m, ctx, `${type.toLowerCase()} ${n.name ?? ''} without geometry, shown as a placeholder`);
    }
    const path = transformedPath(local.path, m);
    const shaped = common(n, m, ctx);
    const box = isRotated(m) ? pathBox(path) : shaped.box;
    return { kind: LayerKind.Shape, ...shaped, box, rotation: 0, path, fillRule: local.rule, fills: fillsOf(n.fillPaints, ctx.report), strokes: strokesOf(n, ctx.report) };
  }
  return placeholderOf(n, m, ctx, `${type.toLowerCase()} ${n.name ?? ''} shown as a placeholder`);
}

function frameLayer(n: FigmaRawNode, m: Matrix, ctx: Ctx): FrameLayer {
  const stacked = autoLayoutOf(n, ctx.report);
  const upright = !isRotated(m);
  if (stacked && !upright) {
    ctx.report(`auto layout of rotated frame ${n.name ?? ''} kept as fixed positions`);
  }
  const clips = n.type !== 'GROUP' && !n.resizeToFit && n.frameMaskDisabled === false;
  const { kids, within } = childrenOf(n, ctx);
  return {
    kind: LayerKind.Frame,
    component: componentOf(n, ctx),
    ...common(n, m, ctx),
    fills: fillsOf(n.fillPaints, ctx.report),
    strokes: strokesOf(n, ctx.report),
    radii: radiiOf(n),
    outline: transformedPath(roundedRect(n.size ?? { x: 0, y: 0 }, radiiOf(n)), m),
    clip: clips ? Clip.Content : Clip.None,
    autoLayout: upright ? stacked : null,
    children: kids.flatMap((c) => layerOf(c, m, within) ?? [])
  };
}

type Extent = { left: number; top: number; right: number; bottom: number };

const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1]
];

function corners(box: Box, degrees: number): Vec[] {
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const [cos, sin] = [Math.cos((degrees * Math.PI) / HALF_TURN), Math.sin((degrees * Math.PI) / HALF_TURN)];
  return CORNERS.map(([sx, sy]) => {
    const [dx, dy] = [(sx * box.width) / 2, (sy * box.height) / 2];
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

function extentOf(layer: Layer): Extent {
  const upright = layer.kind === LayerKind.Text && layer.rotation ? corners(layer.box, 0) : [];
  const own = [...corners(layer.box, layer.rotation), ...upright];
  const inside = layer.kind === LayerKind.Frame && layer.clip === Clip.None ? layer.children.map(extentOf) : [];
  const xs = [...own.map((p) => p.x), ...inside.flatMap((e) => [e.left, e.right])];
  const ys = [...own.map((p) => p.y), ...inside.flatMap((e) => [e.top, e.bottom])];
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

function union(extents: Extent[]): Extent {
  return { left: Math.min(...extents.map((e) => e.left)), top: Math.min(...extents.map((e) => e.top)), right: Math.max(...extents.map((e) => e.right)), bottom: Math.max(...extents.map((e) => e.bottom)) };
}

const byPosition = (a: FigmaRawNode, b: FigmaRawNode) => ((a.parentIndex?.position ?? '') < (b.parentIndex?.position ?? '') ? -1 : 1);

const shifted = (to: Vec): Matrix => ({ ...IDENTITY, m02: -to.x, m12: -to.y });

const middleOf = (e: Extent): Vec => ({ x: (e.left + e.right) / 2, y: (e.top + e.bottom) / 2 });

type Top = { node: FigmaRawNode; extent: Extent };

const BUILD_TOP: Record<Destination, (top: Top, ctx: Ctx) => Layer | null> = {
  [Destination.Frame]: (top, ctx) => ({ ...frameLayer(top.node, IDENTITY, ctx), clip: Clip.Content }),
  [Destination.Free]: (top, ctx) => layerOf(top.node, shifted({ x: top.extent.left, y: top.extent.top }), ctx)
};

const SIZE_OF: Record<Destination, (layer: Layer, extent: Extent) => { width: number; height: number }> = {
  [Destination.Frame]: (layer) => ({ width: layer.box.width, height: layer.box.height }),
  [Destination.Free]: (_, extent) => ({ width: round(extent.right - extent.left), height: round(extent.bottom - extent.top) })
};

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
  const ctx: Ctx = { byKey, children, blobs: message.blobs, report: (what) => skipped.add(what.trim()), scope: OUTSIDE };
  const internal = new Set(message.nodes.filter((n) => n.type === 'CANVAS' && n.internalOnly).map((n) => keyOf(n.guid)));
  const nodes = message.nodes.filter((n) => !PAGES.has(n.type ?? '') && n.parentIndex && PAGES.has(byKey.get(keyOf(n.parentIndex.guid))?.type ?? '') && !internal.has(keyOf(n.parentIndex.guid))).sort(byPosition);
  const tops: Top[] = nodes.flatMap((node) => {
    const layer = layerOf(node, IDENTITY, ctx);
    return layer ? [{ node, extent: extentOf(layer) }] : [];
  });
  if (!tops.length) {
    return null;
  }
  const all = union(tops.map((t) => t.extent));
  const centre = middleOf(all);
  const placements = tops.flatMap((top): Placement[] => {
    const destination = destinationOf(top.node.type);
    const layer = BUILD_TOP[destination](top, ctx);
    const at = middleOf(top.extent);
    return layer ? [{ destination, layer, size: SIZE_OF[destination](layer, top.extent), centre: { x: round(at.x - centre.x), y: round(at.y - centre.y) } }] : [];
  });
  const [only] = placements;
  const wrapper: FrameLayer = {
    kind: LayerKind.Frame,
    component: null,
    name:'Figma paste',
    box: { x: 0, y: 0, width: round(all.right - all.left), height: round(all.bottom - all.top) },
    rotation: 0,
    opacity: 1,
    effects: [],
    item: { grow: false, stretch: false, absolute: false },
    fills: [],
    strokes: [],
    radii: [0, 0, 0, 0],
    outline: '',
    clip: Clip.None,
    autoLayout: null,
    children: tops.flatMap((t) => layerOf(t.node, shifted({ x: all.left, y: all.top }), ctx) ?? [])
  };
  const loneFrame = placements.length === 1 && only.destination === Destination.Frame && only.layer.kind === LayerKind.Frame;
  return { placements, combined: loneFrame ? (only.layer as FrameLayer) : wrapper, skipped: [...skipped] };
}
