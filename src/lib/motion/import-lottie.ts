import { unzipSync } from 'fflate';
import { apply2d, mul2d, type Affine } from '@feega/motion-core/motion/affine';
import { FRAME_RATES, MAX_SECONDS } from '@feega/motion-core/motion/design';
import { TrackKind } from '@feega/motion-core/motion/components';
import { Background, MotionFormat, fitsResolution, newClip, newMotionDoc, parseMotionDoc, type MotionClip, type MotionComp, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { MaskKind, MaskMode, Matte, maskSchema, type Mask } from '@feega/motion-core/motion/mask';
import { flatten, mapOutline, pathData, type Contour } from '@feega/motion-core/motion/shape/geometry';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { GOOGLE_FONTS } from './fonts/catalogue';
import { registerFont } from './fonts/ops';
import { CHANNEL_KEYS, applied, sampledChannel, trackChannel, unwrapped, type Channels, type Span } from './lottie-channels';
import { boxOf, chainMatrix, contourOf, ellipseContour, isStar, mapContour, matrixOf, pathOf, rectContour, skews, starContour, translation, type Box, type Ks, type LottiePath } from './lottie-geometry';
import { hasCurvedPath, isAnimated, keysOf, keyTimes, pairAt, scalarAt, valueAt, type LottieProp } from './lottie-prop';
import { decomposeLocal } from '@feega/motion-core/motion/parent';

type Item = {
  ty: string;
  nm?: string;
  hd?: boolean;
  it?: Item[];
  ks?: LottieProp;
  p?: LottieProp;
  s?: LottieProp;
  r?: LottieProp;
  c?: LottieProp;
  o?: LottieProp;
  w?: LottieProp;
  a?: LottieProp;
  e?: LottieProp;
  g?: { p: number; k: LottieProp };
  lc?: number;
  lj?: number;
  t?: number;
  sy?: number;
  pt?: LottieProp;
  ir?: LottieProp;
  or?: LottieProp;
  sk?: LottieProp;
};

type MaskProp = { mode?: string; inv?: boolean; pt?: LottieProp; o?: LottieProp };

type TextDoc = { s?: number; f?: string; t?: string; fc?: number[]; j?: number; sz?: number[]; ps?: number[]; fs?: number };

type LottieLayer = {
  ind?: number;
  parent?: number;
  ty: number;
  nm?: string;
  hd?: boolean;
  ddd?: number;
  ks?: Ks;
  ip: number;
  op: number;
  st?: number;
  sr?: number;
  shapes?: Item[];
  sw?: number;
  sh?: number;
  sc?: string;
  refId?: string;
  w?: number;
  h?: number;
  t?: { d?: { k?: { s?: TextDoc }[] } };
  masksProperties?: MaskProp[];
  tt?: number;
  td?: number;
  tp?: number;
  ef?: unknown[];
  tm?: unknown;
  bm?: number;
};

type LottieAsset = { id: string; layers?: LottieLayer[]; w?: number; h?: number; p?: string };

type LottieFile = { fr?: number; ip?: number; op?: number; w?: number; h?: number; layers?: LottieLayer[]; assets?: LottieAsset[]; fonts?: { list?: { fName?: string; fFamily?: string }[] } };

export type LottieImport = { doc: MotionDoc; skipped: string[] };

type NewId = () => string;

const LayerType = { Precomp: 0, Solid: 1, Image: 2, Null: 3, Shape: 4, Text: 5 } as const;
const LAYER_LABEL: Record<number, string> = { 6: 'audio layer', 13: 'camera layer' };
const SHAPE_LABEL: Record<string, string> = { tm: 'trim path', rp: 'repeater', mm: 'merge paths', rd: 'round corners', zz: 'zig zag', tw: 'twist', pb: 'pucker and bloat', op: 'offset path', gs: 'gradient stroke' };
const MATTE_BY_KIND: Record<number, Matte> = { 1: Matte.Alpha, 2: Matte.AlphaInverted, 3: Matte.Luma, 4: Matte.LumaInverted };
const MASK_MODE: Record<string, MaskMode> = { a: MaskMode.Add, s: MaskMode.Subtract, i: MaskMode.Intersect, f: MaskMode.Difference };
const CAPS = ['butt', 'round', 'square'];
const JOINS = ['miter', 'round', 'bevel'];
const TEXT_ALIGN = ['left', 'right', 'center'];
const PLACEHOLDER = '#d9d9d9';
const DEFAULT_TEXT_COLOUR = '#000000';
const DEFAULT_TEXT_SIZE = 24;
const GLYPH_WIDTH = 0.55;
const LINE_HEIGHT = 1.2;
const ASCENT = 0.9;
const PERCENT = 100;
const DIGITS = 10000;
const EDGE = 1e-6;
const MAX_STROKE = 0.2;
const MAX_POINTS = 64;
const MIN_POINTS = 3;
const MAX_VISUAL_TRACKS = 19;
const MASK_LIMIT = 30;
const FRAME_MIN = 16;
const FRAME_MAX = 3840;
const FRAME_SHORT_MAX = 2160;
const ZIP_MAGIC = [0x50, 0x4b];
const DOT_LOTTIE_ANIMATION = /^(?:animations|a)\/[^/]+\.json$/;
const NOT_LOTTIE = 'This is not a Lottie animation: it needs width, height, frame rate and layers.';
const ANGLE_DIGITS = 100;
const RADIAL_MIN = 0.01;
const RADIAL_MAX = 4;
const FILL_NONE = 'none';

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const known = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function hex(c: readonly number[]): string {
  const scale = c.slice(0, 3).some((v) => v > 1) ? 255 : 1;
  return `#${[0, 1, 2].map((i) => Math.round(clamp((c[i] ?? 0) / scale, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const withAlpha = (colour: string, alpha: number) => (alpha >= 1 ? colour : `${colour}${Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0')}`);

type Stop = { color: string; pos: number };
type FillSpec = { kind: 'solid'; color: string; opacity: number } | { kind: 'linear' | 'radial'; stops: Stop[]; from: [number, number]; to: [number, number]; opacity: number };
type StrokeSpec = { color: string; width: number; cap: string; join: string };
type PaintSpec = { fills: FillSpec[]; stroke: StrokeSpec | null; evenOdd: boolean };

type Piece = { component: 'Shape' | 'Text' | 'Precomp'; contours: Contour[]; groups: Ks[]; paint: PaintSpec | null; props: Record<string, unknown> };

type View = { w: number; h: number; base: number; duration: number; layers: LottieLayer[] };

type Ctx = { newId: NewId; skipped: Set<string>; assets: Map<string, LottieAsset>; families: Map<string, string>; base: MotionDoc; comps: Record<string, MotionComp>; compIds: Map<string, string | null> };

const note = (ctx: Ctx, layer: LottieLayer, what: string) => ctx.skipped.add(`${layer.nm ?? 'layer'}: ${what}`);

function stopsOf(g: { p: number; k: LottieProp }, at: number): Stop[] {
  const flat = valueAt(g.k, at);
  const colours = Array.from({ length: g.p }, (_, n) => ({ pos: flat[4 * n] ?? 0, rgb: [flat[4 * n + 1] ?? 0, flat[4 * n + 2] ?? 0, flat[4 * n + 3] ?? 0] }));
  const tail = flat.slice(4 * g.p);
  const alphas = Array.from({ length: Math.floor(tail.length / 2) }, (_, n) => ({ pos: tail[2 * n], a: tail[2 * n + 1] }));
  const alphaAt = (pos: number) => {
    if (!alphas.length) {
      return 1;
    }
    const after = alphas.findIndex((a) => a.pos >= pos);
    if (after <= 0) {
      return alphas[Math.max(after, 0)].a;
    }
    const lo = alphas[after - 1];
    const hi = alphas[after];
    return lo.a + ((hi.a - lo.a) * (pos - lo.pos)) / Math.max(hi.pos - lo.pos, EDGE);
  };
  return colours.map((c) => ({ color: withAlpha(hex(c.rgb), alphaAt(c.pos)), pos: round(clamp(c.pos, 0, 1)) }));
}

function paintOf(items: Item[], at: number, ctx: Ctx, layer: LottieLayer): PaintSpec {
  const fills: FillSpec[] = [];
  let stroke: StrokeSpec | null = null;
  let evenOdd = false;
  for (const item of items) {
    if (item.hd) {
      continue;
    }
    if (item.ty === 'fl' && item.c) {
      fills.push({ kind: 'solid', color: hex(valueAt(item.c, at)), opacity: scalarAt(item.o, at, PERCENT) / PERCENT });
      evenOdd = evenOdd || (item as { r?: number }).r === 2;
      if (isAnimated(item.c) || isAnimated(item.o)) {
        note(ctx, layer, 'animated fill colour');
      }
      continue;
    }
    if (item.ty === 'gf' && item.g && item.s && item.e) {
      fills.push({ kind: item.t === 2 ? 'radial' : 'linear', stops: stopsOf(item.g, at), from: pairAt(item.s, at, [0, 0]), to: pairAt(item.e, at, [0, 0]), opacity: scalarAt(item.o, at, PERCENT) / PERCENT });
      evenOdd = evenOdd || (item as { r?: number }).r === 2;
      continue;
    }
    if (item.ty === 'st' && item.c && !stroke) {
      stroke = { color: withAlpha(hex(valueAt(item.c, at)), scalarAt(item.o, at, PERCENT) / PERCENT), width: scalarAt(item.w, at, 1), cap: CAPS[(item.lc ?? 1) - 1] ?? 'butt', join: JOINS[(item.lj ?? 1) - 1] ?? 'miter' };
      if (isAnimated(item.c) || isAnimated(item.w)) {
        note(ctx, layer, 'animated stroke');
      }
      continue;
    }
    if (SHAPE_LABEL[item.ty]) {
      note(ctx, layer, SHAPE_LABEL[item.ty]);
    }
  }
  return { fills, stroke, evenOdd };
}

function geometryOf(item: Item, at: number, ctx: Ctx, layer: LottieLayer): Contour[] {
  if (item.hd) {
    return [];
  }
  if (item.ty === 'sh' && item.ks) {
    if (isAnimated(item.ks)) {
      note(ctx, layer, 'animated path');
    }
    const path = pathOf(item.ks);
    return path?.v?.length ? [contourOf(path as LottiePath)] : [];
  }
  const [px, py] = pairAt(item.p, at, [0, 0]);
  const [sw, sh] = pairAt(item.s, at, [0, 0]);
  if (item.ty === 'rc') {
    if (isAnimated(item.s) || isAnimated(item.p)) {
      note(ctx, layer, 'animated shape size');
    }
    return [rectContour(px - sw / 2, py - sh / 2, sw, sh, scalarAt(item.r, at, 0))];
  }
  if (item.ty === 'el') {
    return [ellipseContour(px, py, sw, sh)];
  }
  if (isStar(item.ty)) {
    return [starContour({ kind: item.sy ?? 1, points: scalarAt(item.pt, at, 5), cx: px, cy: py, turn: scalarAt(item.r, at, 0), outer: scalarAt(item.or, at, 0), inner: scalarAt(item.ir, at, 0) })];
  }
  return [];
}

function shapePieces(layer: LottieLayer, at: number, ctx: Ctx): Piece[] {
  const out: Piece[] = [];
  const visit = (items: Item[], groups: Ks[]) => {
    const transform = items.find((i) => i.ty === 'tr' && !i.hd) as Ks | undefined;
    const chain = transform ? [...groups, transform] : groups;
    const paint = paintOf(items, at, ctx, layer);
    const painted = paint.fills.length > 0 || paint.stroke !== null;
    for (const item of items) {
      const contours = geometryOf(item, at, ctx, layer);
      if (painted) {
        contours.forEach((contour) => out.push({ component: 'Shape', contours: [contour], groups: chain, paint, props: {} }));
      }
      if (item.ty === 'gr' && !item.hd && item.it) {
        visit(item.it, chain);
      }
    }
  };
  visit(layer.shapes ?? [], []);
  return out;
}

const solidPaint = (colour: string): PaintSpec => ({ fills: [{ kind: 'solid', color: colour, opacity: 1 }], stroke: null, evenOdd: false });

function textPiece(layer: LottieLayer, ctx: Ctx): Piece | null {
  const spec = layer.t?.d?.k?.[0]?.s;
  if (!spec?.t) {
    return null;
  }
  if ((layer.t?.d?.k?.length ?? 0) > 1) {
    note(ctx, layer, 'animated text');
  }
  const size = spec.s ?? DEFAULT_TEXT_SIZE;
  const lines = spec.t.split(/\r\n|\r|\n/);
  const boxed = spec.sz && spec.ps;
  const width = boxed ? spec.sz![0] : Math.max(...lines.map((l) => l.length), 1) * size * GLYPH_WIDTH;
  const height = boxed ? spec.sz![1] : lines.length * size * LINE_HEIGHT;
  const justify = spec.j ?? 0;
  const left = boxed ? spec.ps![0] : justify === 1 ? -width : justify === 2 ? -width / 2 : 0;
  const top = boxed ? spec.ps![1] : -size * ASCENT;
  const family = ctx.families.get(spec.f ?? '') ?? spec.f;
  const font = family ? fontFor(family, ctx, layer) : null;
  return {
    component: 'Text',
    contours: [rectContour(left, top, width, height)],
    groups: [],
    paint: null,
    props: { text: lines.join('\n'), color: hex(spec.fc ?? [0, 0, 0]), size, align: TEXT_ALIGN[justify] ?? 'left', verticalAlign: 'top', ...(font ? { font } : {}) }
  };
}

function fontFor(family: string, ctx: Ctx, layer: LottieLayer): string | null {
  if (ctx.base.fonts.some((f) => f.family === family)) {
    return family;
  }
  const made = registerFont(ctx.base, family, GOOGLE_FONTS);
  if (!made.ok) {
    note(ctx, layer, `font ${family} replaced by the default`);
    return null;
  }
  ctx.base = made.doc;
  return family;
}

function layerPieces(layer: LottieLayer, view: View, at: number, ctx: Ctx): Piece[] {
  if (layer.ty === LayerType.Shape) {
    return shapePieces(layer, at, ctx);
  }
  if (layer.ty === LayerType.Solid) {
    return [{ component: 'Shape', contours: [rectContour(0, 0, layer.sw ?? view.w, layer.sh ?? view.h)], groups: [], paint: solidPaint(layer.sc ?? PLACEHOLDER), props: {} }];
  }
  if (layer.ty === LayerType.Image) {
    note(ctx, layer, 'image layer drawn as a grey placeholder');
    const asset = ctx.assets.get(layer.refId ?? '');
    return [{ component: 'Shape', contours: [rectContour(0, 0, asset?.w ?? layer.w ?? view.w, asset?.h ?? layer.h ?? view.h)], groups: [], paint: solidPaint(PLACEHOLDER), props: {} }];
  }
  if (layer.ty === LayerType.Text) {
    const piece = textPiece(layer, ctx);
    return piece ? [piece] : [];
  }
  if (layer.ty === LayerType.Precomp) {
    const w = layer.w ?? view.w;
    const h = layer.h ?? view.h;
    const comp = compFor(layer.refId ?? '', w, h, ctx, layer);
    return comp ? [{ component: 'Precomp', contours: [rectContour(0, 0, w, h)], groups: [], paint: null, props: { comp } }] : [];
  }
  return [];
}

function unsupportedOf(layer: LottieLayer, ctx: Ctx) {
  if (layer.ddd === 1) {
    note(ctx, layer, '3d layer drawn flat');
  }
  if (layer.ef?.length) {
    note(ctx, layer, 'effects');
  }
  if (layer.tm) {
    note(ctx, layer, 'time remap');
  }
  if (layer.bm) {
    note(ctx, layer, 'blend mode');
  }
  if (layer.ks && skews(layer.ks)) {
    note(ctx, layer, 'skew');
  }
  if (hasCurvedPath(layer.ks?.p)) {
    note(ctx, layer, 'curved motion path');
  }
}

function ancestorsOf(layer: LottieLayer, view: View): LottieLayer[] {
  const chain: LottieLayer[] = [];
  let next = view.layers.find((l) => l.ind === layer.parent && layer.parent !== undefined);
  while (next && !chain.includes(next) && chain.length < view.layers.length) {
    chain.unshift(next);
    next = view.layers.find((l) => l.ind === next!.parent && next!.parent !== undefined);
  }
  return chain;
}

const spanOf = (layer: LottieLayer, view: View): Span | null => {
  const start = Math.max(Math.round(layer.ip), view.base);
  const end = Math.min(Math.round(layer.op), view.base + view.duration);
  return end > start ? { start, end } : null;
};

function fillProps(spec: FillSpec, box: Box, map: (p: [number, number]) => [number, number]): Record<string, unknown> {
  const opacity = spec.opacity < 1 ? { opacity: round(spec.opacity) } : {};
  if (spec.kind === 'solid') {
    return { type: FillType.Solid, color: spec.color, ...opacity };
  }
  const from = map(spec.from);
  const to = map(spec.to);
  if (spec.kind === 'linear') {
    const angle = (Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI;
    return { type: FillType.Linear, stops: spec.stops, angle: Math.round(angle * ANGLE_DIGITS) / ANGLE_DIGITS, ...opacity };
  }
  const bw = Math.max(box.right - box.left, EDGE);
  const bh = Math.max(box.bottom - box.top, EDGE);
  const radius = Math.hypot(to[0] - from[0], to[1] - from[1]) / (Math.max(bw, bh) / 2);
  return { type: FillType.Radial, stops: spec.stops, center: { x: clamp((from[0] - box.left) / bw, 0, 1), y: clamp((from[1] - box.top) / bh, 0, 1) }, radius: round(clamp(radius, RADIAL_MIN, RADIAL_MAX)), ...opacity };
}

function paintProps(spec: PaintSpec, box: Box, side: number, map: (p: [number, number]) => [number, number]): Record<string, unknown> {
  const plain = spec.fills.length === 1 && spec.fills[0].kind === 'solid' && spec.fills[0].opacity >= 1;
  const fills = plain ? { fill: (spec.fills[0] as { color: string }).color } : spec.fills.length ? { fills: spec.fills.map((f) => fillProps(f, box, map)) } : { fillKind: FILL_NONE };
  const stroke = spec.stroke ? { strokeKind: 'solid', stroke: spec.stroke.color, strokeWidth: round(clamp(spec.stroke.width / side, 0, MAX_STROKE)), cap: spec.stroke.cap, join: spec.stroke.join } : {};
  return { ...fills, ...stroke, ...(spec.evenOdd ? { fillRule: 'evenodd' } : {}) };
}

function maskOf(prop: MaskProp, at: number, shift: [number, number], view: View, ctx: Ctx, layer: LottieLayer): Mask | null {
  const mode = MASK_MODE[prop.mode ?? 'a'];
  if (!mode || !prop.pt) {
    return null;
  }
  if (isAnimated(prop.pt)) {
    note(ctx, layer, 'animated mask');
  }
  const path = pathOf(prop.pt);
  if (!path?.v?.length) {
    return null;
  }
  const points = flatten(contourOf(path as LottiePath)).map((p): [number, number] => [p[0] + shift[0], p[1] + shift[1]]);
  const stride = Math.ceil(points.length / MAX_POINTS);
  const sampled = points.filter((_, n) => n % stride === 0);
  if (sampled.length < MIN_POINTS) {
    return null;
  }
  const xs = sampled.map((p) => p[0]);
  const ys = sampled.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const bw = Math.max(Math.max(...xs) - left, EDGE);
  const bh = Math.max(Math.max(...ys) - top, EDGE);
  const parsed = maskSchema.safeParse({
    kind: MaskKind.Polygon,
    mode,
    invert: prop.inv === true,
    x: clamp((left + bw / 2) / view.w, -MASK_LIMIT, MASK_LIMIT),
    y: clamp((top + bh / 2) / view.h, -MASK_LIMIT, MASK_LIMIT),
    width: clamp(bw / view.w, 0, MASK_LIMIT * 2),
    height: clamp(bh / view.h, 0, MASK_LIMIT * 2),
    opacity: clamp(scalarAt(prop.o, at, PERCENT) / PERCENT, 0, 1),
    points: sampled.map((p) => [clamp((p[0] - left) / bw, 0, 1), clamp((p[1] - top) / bh, 0, 1)])
  });
  return parsed.success ? parsed.data : null;
}

function sampledChannels(layer: LottieLayer, piece: Piece, view: View, span: Span, parents: Ks[], shift: [number, number], pivot: [number, number], groupOpacity: (t: number) => number): Channels {
  const ks = layer.ks ?? {};
  const own = [ks, ...piece.groups];
  const animatedTimes = [...parents, ...own].flatMap((k) => [k.p, k.a, k.s, k.r, k.o].flatMap((p) => keyTimes(p)));
  const lastFrame = animatedTimes.some((t) => t >= span.end) ? span.end : span.end - 1;
  const frames = Array.from({ length: lastFrame - span.start + 1 }, (_, n) => span.start + n);
  const poses = frames.map((t) => {
    const total = mul2d(chainMatrix([...parents, ...own], t), translation(-shift[0], -shift[1]));
    return decomposeLocal(total, pivot);
  });
  const finite = poses.map((p, n) => (Object.values(p).every(Number.isFinite) ? p : (poses.slice(0, n).findLast((q) => Object.values(q).every(Number.isFinite)) ?? { x: 0, y: 0, rotateZ: 0, scaleX: 1, scaleY: 1 })));
  const relative = frames.map((t) => t - span.start);
  return {
    x: sampledChannel('x', relative, finite.map((p) => p.x / view.w)),
    y: sampledChannel('y', relative, finite.map((p) => p.y / view.h)),
    rotateZ: sampledChannel('rotateZ', relative, unwrapped(finite.map((p) => p.rotateZ))),
    scaleX: sampledChannel('scaleX', relative, finite.map((p) => p.scaleX)),
    scaleY: sampledChannel('scaleY', relative, finite.map((p) => p.scaleY)),
    opacity: sampledChannel('opacity', relative, frames.map((t) => (scalarAt(ks.o, t, PERCENT) / PERCENT) * groupOpacity(t)))
  };
}

function directChannels(ks: Ks, span: Span, view: View, anchor: [number, number], shift: [number, number], opacity: number): Channels {
  const stillOf = (k: number[]): LottieProp => ({ a: 0, k });
  const p = ks.p ?? stillOf([0, 0]);
  const s = ks.s ?? stillOf([PERCENT, PERCENT]);
  const found = {
    x: trackChannel('x', p, 0, span, (v) => (v - anchor[0] - shift[0]) / view.w),
    y: trackChannel('y', p, 1, span, (v) => (v - anchor[1] - shift[1]) / view.h),
    rotateZ: trackChannel('rotateZ', ks.r, 0, span, (v) => v),
    scaleX: trackChannel('scaleX', s, 0, span, (v) => v / PERCENT),
    scaleY: trackChannel('scaleY', s, 1, span, (v) => v / PERCENT),
    opacity: trackChannel('opacity', ks.o, 0, span, (v) => (v / PERCENT) * opacity)
  };
  return Object.fromEntries(CHANNEL_KEYS.flatMap((key) => (found[key] ? [[key, found[key]!]] : []))) as Channels;
}

function clipOf(piece: Piece, layer: LottieLayer, view: View, span: Span, ctx: Ctx): MotionClip | null {
  const ks = layer.ks ?? {};
  const parents = ancestorsOf(layer, view).map((l) => l.ks ?? {});
  const groupsAnimated = piece.groups.some((g) => [g.p, g.a, g.s, g.r, g.o].some((p) => isAnimated(p)));
  const groupMatrix = chainMatrix(piece.groups, span.start);
  const groupOpacity = (t: number) => piece.groups.reduce((n, g) => n * (scalarAt(g.o, t, PERCENT) / PERCENT), 1);
  const stable = !parents.length && !groupsAnimated && !isAnimated(ks.a);
  const baked = (stable ? piece.contours.map((c) => mapContour(c, groupMatrix)) : piece.contours);
  const box = boxOf(baked);
  if (!box) {
    return null;
  }
  const bw = box.right - box.left;
  const bh = box.bottom - box.top;
  const anchor = pairAt(ks.a, span.start, [0, 0]);
  const fx = (anchor[0] - box.left) / bw;
  const fy = (anchor[1] - box.top) / bh;
  const direct = stable && bw > EDGE && bh > EDGE && fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1;
  const centre: [number, number] = [(box.left + box.right) / 2, (box.top + box.bottom) / 2];
  const start = direct ? matrixOf(ks, span.start) : mul2d(chainMatrix([...parents, ks], span.start), groupMatrix);
  const [wx, wy] = apply2d(start as Affine, centre);
  const shift: [number, number] = piece.component === 'Precomp' ? [0, 0] : [clamp(wx, 0, view.w) - centre[0], clamp(wy, 0, view.h) - centre[1]];
  const channels = direct ? directChannels(ks, span, view, anchor, shift, groupOpacity(span.start)) : sampledChannels(layer, piece, view, span, parents, shift, [centre[0] + shift[0], centre[1] + shift[1]], groupOpacity);
  const { transform, keyframes } = applied(channels);
  const unitOf = (p: readonly [number, number]): [number, number] => [(p[0] - box.left) / Math.max(bw, EDGE), (p[1] - box.top) / Math.max(bh, EDGE)];
  const placed = { x: round((centre[0] + shift[0]) / view.w), y: round((centre[1] + shift[1]) / view.h), width: round(Math.max(bw, 0) / view.w), height: round(Math.max(bh, 0) / view.h) };
  const side = Math.min(view.w, view.h);
  const mapGradient = (p: [number, number]): [number, number] => (stable ? apply2d(groupMatrix, p) : p);
  const props =
    piece.component === 'Shape'
      ? { shape: ShapeKind.Path, path: pathData(mapOutline(baked, unitOf)), ...placed, ...(piece.paint ? paintProps(piece.paint, box, side, mapGradient) : {}) }
      : piece.component === 'Text'
        ? { ...piece.props, size: round((piece.props.size as number) / side), ...placed }
        : piece.props;
  const masks = (layer.masksProperties ?? []).flatMap((m) => maskOf(m, span.start, shift, view, ctx, layer) ?? []);
  const precompStart = piece.component === 'Precomp' ? Math.max(0, span.start - (layer.st ?? 0)) : 0;
  return newClip({
    id: ctx.newId(),
    name: (layer.nm ?? 'layer').slice(0, 60),
    from: span.start - view.base,
    durationInFrames: span.end - span.start,
    component: piece.component,
    props,
    transform: { ...transform, ...(direct ? { anchorX: round(fx), anchorY: round(fy) } : {}) },
    keyframes,
    trimStart: precompStart,
    mask: masks[0] ?? null,
    maskStack: masks.slice(1)
  });
}

function layerClips(layer: LottieLayer, view: View, ctx: Ctx): MotionClip[] {
  if (layer.hd) {
    return [];
  }
  if (LAYER_LABEL[layer.ty]) {
    note(ctx, layer, LAYER_LABEL[layer.ty]);
    return [];
  }
  const span = spanOf(layer, view);
  if (!span || layer.ty === LayerType.Null) {
    return [];
  }
  unsupportedOf(layer, ctx);
  return layerPieces(layer, view, span.start, ctx)
    .flatMap((piece) => clipOf(piece, layer, view, span, ctx) ?? [])
    .reverse();
}

function matteLinks(view: View, clips: MotionClip[][]) {
  view.layers.forEach((layer, index) => {
    const matte = MATTE_BY_KIND[layer.tt ?? 0];
    if (!matte || !clips[index].length) {
      return;
    }
    const sourceIndex = layer.tp === undefined ? index - 1 : view.layers.findIndex((l) => l.ind === layer.tp);
    const source = clips[sourceIndex]?.[0];
    if (!source) {
      return;
    }
    clips[index].forEach((clip) => {
      clip.matte = matte;
      clip.matteFrom = source.id;
    });
  });
}

function tracksOf(view: View, ctx: Ctx): MotionTrack[] {
  const clips = view.layers.map((layer) => layerClips(layer, view, ctx));
  matteLinks(view, clips);
  const visual = view.layers.flatMap((layer, index) => (clips[index].length ? [{ layer, clips: clips[index] }] : []));
  const kept = visual.slice(0, MAX_VISUAL_TRACKS);
  const rest = visual.slice(MAX_VISUAL_TRACKS).flatMap((v) => v.clips);
  if (rest.length) {
    ctx.skipped.add(`${visual.length - MAX_VISUAL_TRACKS} layers merged into the last track`);
  }
  return kept.map((v, n) => ({ id: `l${n + 1}`, kind: TrackKind.Visual, name: (v.layer.nm ?? `Layer ${n + 1}`).slice(0, 60), clips: n === kept.length - 1 ? [...v.clips, ...rest] : v.clips }));
}

function compFor(refId: string, w: number, h: number, ctx: Ctx, layer: LottieLayer): string | null {
  if (ctx.compIds.has(refId)) {
    return ctx.compIds.get(refId) ?? null;
  }
  const asset = ctx.assets.get(refId);
  if (!asset?.layers) {
    note(ctx, layer, 'precomposition without layers');
    return null;
  }
  ctx.compIds.set(refId, null);
  const id = ctx.newId();
  const duration = Math.max(1, Math.round(Math.max(...asset.layers.map((l) => l.op), 1)));
  const view: View = { w: asset.w ?? w, h: asset.h ?? h, base: 0, duration, layers: asset.layers };
  const tracks = tracksOf(view, ctx);
  ctx.comps[id] = { name: refId.slice(0, 60) || 'composition', durationInFrames: duration, frame: { width: Math.max(FRAME_MIN, Math.round(view.w)), height: Math.max(FRAME_MIN, Math.round(view.h)) }, tracks };
  ctx.compIds.set(refId, id);
  return id;
}

function frameSize(w: number, h: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  const shortest = Math.min(w, h);
  const factor = Math.max(FRAME_MIN / shortest, 1) * Math.min(1, FRAME_MAX / longest, w === h ? FRAME_SHORT_MAX : FRAME_SHORT_MAX / shortest);
  const size = { width: Math.max(1, Math.round(w * factor)), height: Math.max(1, Math.round(h * factor)) };
  return fitsResolution(size) ? size : { width: Math.max(FRAME_MIN, Math.round(w * factor * 0.5)), height: Math.max(FRAME_MIN, Math.round(h * factor * 0.5)) };
}

const nearestRate = (fr: number): number => FRAME_RATES.reduce((best, rate) => (Math.abs(rate - fr) < Math.abs(best - fr) ? rate : best), FRAME_RATES[0]);

function isLottie(json: unknown): json is LottieFile {
  if (!known(json)) {
    return false;
  }
  return [json.w, json.h, json.fr].every((n) => typeof n === 'number' && n > 0) && Array.isArray(json.layers);
}

export function importLottie(json: unknown, newId: NewId = () => crypto.randomUUID().slice(0, 8)): LottieImport | string {
  if (!isLottie(json)) {
    return NOT_LOTTIE;
  }
  const file = json;
  const fps = nearestRate(file.fr!);
  const ip = Math.round(file.ip ?? 0);
  const total = Math.max(1, Math.round((file.op ?? ip + 1) - ip));
  const duration = Math.min(total, MAX_SECONDS * fps);
  const skipped = new Set<string>();
  if (duration < total) {
    skipped.add(`animation cut to ${MAX_SECONDS} seconds`);
  }
  if (fps !== file.fr) {
    skipped.add(`frame rate ${file.fr} played at ${fps}`);
  }
  const size = frameSize(file.w!, file.h!);
  const blank = newMotionDoc(MotionFormat.Custom);
  const families = new Map((file.fonts?.list ?? []).flatMap((f) => (f.fName && f.fFamily ? [[f.fName, f.fFamily] as const] : [])));
  const ctx: Ctx = {
    newId,
    skipped,
    assets: new Map((file.assets ?? []).map((a) => [a.id, a])),
    families,
    base: { ...blank, ...size, fps: fps as MotionDoc['fps'], durationInFrames: duration, background: Background.Transparent },
    comps: {},
    compIds: new Map()
  };
  const view: View = { w: file.w!, h: file.h!, base: ip, duration, layers: file.layers! };
  const visual = tracksOf(view, ctx);
  const audio = ctx.base.tracks.filter((t) => t.kind === TrackKind.Audio);
  const verdict = parseMotionDoc({ ...ctx.base, tracks: [...visual, ...audio], comps: ctx.comps });
  if (!verdict.ok) {
    return `Could not build the animation: ${verdict.error}`;
  }
  return { doc: verdict.doc, skipped: [...skipped] };
}

const dotLottieEntry = (files: Record<string, Uint8Array>): Uint8Array | null => {
  const name = Object.keys(files).sort().find((n) => DOT_LOTTIE_ANIMATION.test(n));
  return name ? files[name] : null;
};

export function lottieSource(bytes: Uint8Array): unknown {
  const zipped = ZIP_MAGIC.every((b, n) => bytes[n] === b);
  const unzipped = zipped ? safely(() => dotLottieEntry(unzipSync(bytes))) : bytes;
  if (!unzipped) {
    return 'This dotLottie file holds no animation.';
  }
  const parsed = safely(() => JSON.parse(new TextDecoder().decode(unzipped)) as unknown);
  return parsed === null ? 'This file is not valid JSON.' : parsed;
}

function safely<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}
