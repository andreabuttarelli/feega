import { resolveColor, type BrandTokens } from '../brand';
import { Background, type MotionClip, type MotionDoc } from '../doc';
import { TrackKind, type ComponentId } from '../components';
import { animProp, sampleColor, Source, TRANSFORM, ValueKind, type TransformKey } from '../keyframes';
import { sampleTrack } from '../sample-track';
import { IDENTITY, ParentOpacity, ancestorsOf, mul2d, transformAt, worldAt, type Affine } from '../parent';
import { boxOf } from '../layout';
import { preparedDoc } from '../hyperframes/compose';
import type { SvgNode } from '../effects/registry';
import { renderAt } from '../effects/render';
import { effectOfKey } from '../effects/model';
import { cssFunctions, unsupportedPrimitive, type CssFunction } from './filters';
import { BlendMode } from '../blend';
import { mattePairs, MATTE_READ } from '../matte';
import { maskLayers, type MaskLayer } from './mask-layers';import { FillType, fillsOf, type Fill, type FillOf } from '../fill/model';
import { StrokeAlign, strokesOf, type Stroke } from '../stroke/model';
import { Cap, Join, dashes, strokePolygons } from './stroke';
import { shapeLayers, type ShapeLook } from '../shape/render';
import { modifierFilter } from '../shape/modifiers';
import { ShapeKind, modifierValues } from '../shape/schema';
import { flatten, rectOutline, type Outline } from '../shape/geometry';
import { rgbaOf, type Rgba } from './rgba';
import { sourceSeconds } from '../time-remap';
import { edgeAt, moveAt, type Pose } from './edges';
import { stillSeconds } from '../still';
import { NO_TYPESET, paintText, TEXT_COMPONENTS, TextGap, type TextComponent, type Typeset } from './text/painter';

export { CoverKind, RampKind, type Cover, type MaskLayer } from './mask-layers';

export enum ItemKind {
  Path = 'path',
  Image = 'image'
}

export enum PaintKind {
  Solid = 'solid',
  Linear = 'linear',
  Radial = 'radial'
}

export enum FillRule {
  NonZero = 'nonzero',
  EvenOdd = 'evenodd',
  Union = 'union'
}

export enum Unsupported {
  Component = 'component',
  Effect = 'effect',
  Mask = 'mask',
  Blend = 'blend',
  Animator = 'animator',
  Shader = 'shader',
  Space3d = 'space-3d',
  Keyframe = 'keyframe',
  Stroke = 'stroke',
  Modifier = 'modifier',
  Fill = 'fill',
  Pattern = 'pattern',
  ShapeKind = 'shape-kind',
  Text = 'text',
  Font = 'font',
  Glyph = 'glyph',
  TextPath = 'text-path'
}

export type Stop = { at: number; color: Rgba };

export type Paint =
  | { kind: PaintKind.Solid; color: Rgba }
  | { kind: PaintKind.Linear; from: [number, number]; to: [number, number]; stops: Stop[] }
  | { kind: PaintKind.Radial; center: [number, number]; radius: number; stops: Stop[] };

export type Scissor = [number, number, number, number];

export type Within = { contours: number[][]; outside: boolean };

export type PathItem = { kind: ItemKind.Path; clip: string; contours: number[][]; rule: FillRule; paint: Paint; opacity: number; matrix: Affine; blur: number; blend: BlendMode; within?: Within; scissor?: Scissor; masks?: MaskLayer[]; matte?: MatteOf; filters?: Filter[]; space?: Linear; backdrop?: number };

export type ImageItem = { kind: ItemKind.Image; clip: string; src: string; video: boolean; mediaTime: number; size: Size; fit: string; focus: [number, number]; zoom: number; clipped: boolean; inner: Affine; opacity: number; matrix: Affine; blur: number; blend: BlendMode; scissor?: Scissor; masks?: MaskLayer[]; matte?: MatteOf; filters?: Filter[]; space?: Linear; backdrop?: number };

export type Item = PathItem | ImageItem;

export enum FilterKind {
  Css = 'css',
  Svg = 'svg'
}

export type Filter = { kind: FilterKind.Css; fns: CssFunction[] } | { kind: FilterKind.Svg; nodes: SvgNode[] };

export type Linear = [number, number, number, number];

export type MatteOf = { items: Item[]; luma: boolean; invert: boolean };

export type Gap = { clip: string; component: ComponentId; reason: Unsupported };

export type DisplayList = { width: number; height: number; background: Rgba | null; items: Item[]; unsupported: Gap[] };

export type Prepared = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; typeset: Typeset };

type Content = Omit<PathItem, 'clip' | 'blur' | 'blend' | 'masks' | 'matte' | 'filters' | 'space' | 'backdrop'> | Omit<ImageItem, 'clip' | 'blur' | 'blend' | 'masks' | 'matte' | 'filters' | 'space' | 'backdrop'>;
type Size = { width: number; height: number };
type Painted = Content[] | Unsupported;
type Env = { clip: MotionClip; props: Record<string, unknown>; size: Size; box: Box; stage: Size; unit: number; colour: (v: string) => Rgba; css: (v: string) => string; time: number; media: number; fps: number; still: number | null; asset: (id: unknown) => string | null; logo: string | null; typeset: Typeset };
type Painter = (env: Env) => Painted;

const NO_PAINT: ReadonlySet<ComponentId> = new Set(['Audio', 'Null', 'Precomp', 'Adjustment']);
const DEPTH_KEYS: readonly TransformKey[] = ['z', 'rotateX', 'rotateY', 'skewX', 'skewY'];
const DRAWN_SOURCES: ReadonlySet<Source> = new Set([Source.Transform, Source.Prop, Source.Param]);
const SOLID_PATTERN = 'solid';
const CENTRE = 0.5;
const REMAPPED: ReadonlySet<ComponentId> = new Set(['Video']);
const DEG = Math.PI / 180;

const flat = (outline: Outline): number[][] => outline.map((c) => flatten(c).flatMap(([x, y]) => [x, y]));

const scaleAbout = (cx: number, cy: number, rotation: number, scale: number): Affine => {
  const c = Math.cos(rotation * DEG) * scale;
  const s = Math.sin(rotation * DEG) * scale;
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
};

function stopsOf(stops: { color: string; pos: number }[], colour: (v: string) => Rgba): Stop[] {
  return [...stops].sort((a, b) => a.pos - b.pos).map((s) => ({ at: s.pos, color: colour(s.color) }));
}

const PAINTS: Partial<Record<FillType, (f: never, w: number, h: number, colour: (v: string) => Rgba) => Paint>> = {
  [FillType.Solid]: (f: FillOf<FillType.Solid>, _w, _h, colour) => ({ kind: PaintKind.Solid, color: colour(f.color) }),
  [FillType.Linear]: (f: FillOf<FillType.Linear>, w, h, colour) => {
    const dx = (Math.cos(f.angle * DEG) * w) / 2;
    const dy = (Math.sin(f.angle * DEG) * h) / 2;
    return { kind: PaintKind.Linear, from: [w / 2 - dx, h / 2 - dy], to: [w / 2 + dx, h / 2 + dy], stops: stopsOf(f.stops, colour) };
  },
  [FillType.Radial]: (f: FillOf<FillType.Radial>, w, h, colour) => ({ kind: PaintKind.Radial, center: [f.center.x * w, f.center.y * h], radius: (f.radius * Math.max(w, h)) / 2, stops: stopsOf(f.stops, colour) })
};

const UNDRAWN_SHAPES: ReadonlySet<ShapeKind> = new Set([ShapeKind.Line, ShapeKind.Vector]);

const STRETCH: Record<StrokeAlign, number> = { [StrokeAlign.Center]: 1, [StrokeAlign.Inside]: 2, [StrokeAlign.Outside]: 2 };

const withinOf = (align: StrokeAlign, contours: number[][]): Within | undefined => (align === StrokeAlign.Center ? undefined : { contours, outside: align === StrokeAlign.Outside });

function strokeBands(s: Stroke, outline: Outline, unit: number): number[][] {
  const width = s.width * unit * STRETCH[s.align];
  const runs = outline.flatMap((c) => {
    const pts = flatten(c).flatMap(([x, y]) => [x, y]);
    return s.dash > 0 ? dashes(pts, c.closed, s.dash * unit, (s.gap || s.dash) * unit).map((d) => ({ pts: d, closed: false })) : [{ pts, closed: c.closed }];
  });
  return runs.flatMap((r) => strokePolygons(r.pts, r.closed, width, s.cap as Cap, s.join as Join));
}

function shapePainter({ props, size, unit, colour, time }: Env): Painted {
  const look = props as unknown as ShapeLook;
  const fills = fillsOf(props).filter((f) => f.visible);
  const stack = look.modifiers.filter((m) => m.enabled).map((m) => ({ kind: m.kind, values: modifierValues(m) }));
  const problems: [boolean, Unsupported][] = [
    [UNDRAWN_SHAPES.has(look.shape), Unsupported.ShapeKind],
    [strokesOf(props).some((s) => s.visible && s.sides), Unsupported.Stroke],
    [modifierFilter(stack, Math.min(size.width, size.height)) !== '', Unsupported.Modifier],
    [fills.some((f) => !PAINTS[f.type] || f.blend !== BlendMode.Normal), Unsupported.Fill]
  ];
  const problem = problems.find(([hit]) => hit);
  if (problem) {
    return problem[1];
  }
  const layers = shapeLayers(look, { w: size.width, h: size.height }, time).filter((l) => l.outline.length);
  const rule = look.fillRule === FillRule.EvenOdd ? FillRule.EvenOdd : FillRule.NonZero;
  const paintOf = (f: Fill) => (PAINTS[f.type] as (f: Fill, w: number, h: number, c: typeof colour) => Paint)(f, size.width, size.height, colour);
  const filled = fills.flatMap((f: Fill) => layers.map((l): Content => ({ kind: ItemKind.Path, contours: flat(l.outline), rule, paint: paintOf(f), opacity: f.opacity * l.opacity, matrix: l.matrix as unknown as Affine })));
  const stroked = strokesOf(props)
    .filter((st) => st.visible)
    .flatMap((st) => layers.map((l): Content => ({ kind: ItemKind.Path, contours: strokeBands(st, l.outline, unit), rule: FillRule.Union, paint: paintOf(st.paint as Fill), opacity: st.paint.opacity * l.opacity, matrix: l.matrix as unknown as Affine, within: withinOf(st.align, flat(l.outline)) })));
  return [...filled, ...stroked];
}

function backgroundPainter({ props, size, colour }: Env): Painted {
  if (props.pattern !== SOLID_PATTERN) {
    return Unsupported.Pattern;
  }
  return [{ kind: ItemKind.Path, contours: flat(rectOutline(0, { w: size.width, h: size.height })), rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: colour(String(props.fill)) }, opacity: Number(props.opacity ?? 1), matrix: IDENTITY }];
}

const framing = (props: Record<string, unknown>): [number, number] => [Number(props.focusX ?? CENTRE), Number(props.focusY ?? CENTRE)];

const picture = (src: string, size: Size, look: Partial<Omit<ImageItem, 'kind' | 'clip' | 'blur' | 'blend' | 'src' | 'size'>>): Content => ({ kind: ItemKind.Image, src, size, video: false, mediaTime: 0, fit: 'cover', focus: [CENTRE, CENTRE], zoom: 1, clipped: true, inner: IDENTITY, opacity: 1, matrix: IDENTITY, ...look });

const imagePainter = ({ props, size, asset }: Env): Painted => {
  const src = asset(props.assetId);
  return src ? [picture(src, size, { fit: String(props.fit), focus: framing(props), zoom: Number(props.zoom ?? 1) })] : Unsupported.Component;
};

const videoPainter = ({ props, size, asset, media }: Env): Painted => {
  const src = asset(props.assetId);
  return src ? [picture(src, size, { video: true, mediaTime: media, fit: String(props.fit), focus: framing(props) })] : Unsupported.Component;
};

const logoPainter = ({ props, size, asset, logo }: Env): Painted => {
  const src = asset(props.assetId) ?? logo;
  return src ? [picture(src, size, { fit: 'width', clipped: false })] : Unsupported.Text;
};

const TEXT_GAP: Record<TextGap, Unsupported> = { [TextGap.Font]: Unsupported.Font, [TextGap.Glyph]: Unsupported.Glyph, [TextGap.Fill]: Unsupported.Fill, [TextGap.Stroke]: Unsupported.Stroke };

function textPainter(env: Env): Painted {
  const { clip, props, box, stage, css, time, fps, still, typeset } = env;
  const inks = paintText({ component: clip.component as TextComponent, ...typeset, props, box, stage, colour: css, time, trim: clip.trimStart / fps, fps, still });
  if (!Array.isArray(inks)) {
    return TEXT_GAP[inks];
  }
  return inks.map((ink) => ({ kind: ItemKind.Path as const, contours: ink.contours, rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: ink.color }, opacity: ink.opacity, matrix: ink.matrix }));
}

type Box = { left: number; top: number; width: number; height: number };

type Placement = (props: Record<string, unknown>, frame: Size) => { box: Box; turn: Affine; opacity: number };

const fullFrame: Placement = (_props, frame) => ({ box: { left: 0, top: 0, ...frame }, turn: IDENTITY, opacity: 1 });

const boxed: Placement = (props, frame) => {
  const box = boxOf(props as never, frame);
  const turn = scaleAbout(box.width / 2, box.height / 2, Number(props.rotation ?? 0), Number(props.scale ?? 1));
  return { box, turn, opacity: Number(props.opacity ?? 1) };
};

const PAINTERS: Partial<Record<ComponentId, { place: Placement; paint: Painter }>> = {
  BrandBackground: { place: fullFrame, paint: backgroundPainter },
  Shape: { place: boxed, paint: shapePainter },
  Image: { place: boxed, paint: imagePainter },
  Video: { place: boxed, paint: videoPainter },
  Logo: { place: boxed, paint: logoPainter },
  ...Object.fromEntries(TEXT_COMPONENTS.map((c) => [c, { place: boxed, paint: textPainter }]))
};

const keyed = (clip: MotionClip, keys: readonly string[]) => keys.some((k) => (clip.transform[k as TransformKey] ?? TRANSFORM[k as TransformKey].fallback) !== TRANSFORM[k as TransformKey].fallback || (clip.keyframes[k]?.length ?? 0) > 0);

const drawnKey = (clip: MotionClip, key: string) => effectOfKey(key) !== null || drawnSource(clip, animProp(clip.component, key)?.source);

const drawnSource = (clip: MotionClip, source: Source | undefined) => (source !== undefined && DRAWN_SOURCES.has(source)) || (source === Source.Remap && REMAPPED.has(clip.component));

const keyframedOutside = (clip: MotionClip) => Object.entries(clip.keyframes).some(([key, track]) => track.length > 0 && !drawnKey(clip, key));

const CLIP_LIMITS: [Unsupported, (clip: MotionClip) => boolean][] = [
  [Unsupported.Component, (clip) => !PAINTERS[clip.component]],
  [Unsupported.Animator, (clip) => clip.animators.length > 0],
  [Unsupported.Shader, (clip) => clip.shaders.length > 0],
  [Unsupported.Space3d, (clip) => keyed(clip, DEPTH_KEYS)],
  [Unsupported.Keyframe, keyframedOutside],
  [Unsupported.TextPath, (clip) => clip.textPath !== null]
];

function propsAt(clip: MotionClip, frame: number, colour: (v: string) => string): Record<string, unknown> {
  const local = frame - clip.from;
  const sampled = Object.entries(clip.keyframes).flatMap(([key, track]) => {
    const prop = animProp(clip.component, key);
    if (!prop || !DRAWN_SOURCES.has(prop.source) || prop.source === Source.Transform || !track.length) {
      return [];
    }
    return [[key, prop.kind === ValueKind.Color ? sampleColor(track, local, colour) : sampleTrack(track, local)]];
  });
  return { ...clip.props, ...Object.fromEntries(sampled) };
}

function inheritedOpacity(doc: MotionDoc, clip: MotionClip, byId: Map<string, MotionClip>, frame: number): number {
  const own = transformAt(clip, 'opacity', frame);
  if (clip.parentOpacity === ParentOpacity.Ignore) {
    return own;
  }
  return ancestorsOf(doc, clip.id).reduce((o, id) => o * (byId.get(id) ? transformAt(byId.get(id)!, 'opacity', frame) : 1), own);
}

const blurOf = (clip: MotionClip, frame: number): number => transformAt(clip, 'blur', frame);

const BLUR_PX = /blur\(([\d.]+)px\)/;
const SVG_REF = /^url\(/;

type Filtered = { filters: Filter[]; backdrop: number };

function filtersOf(clip: MotionClip, frame: number, fps: number, size: Size, css: (v: string) => string): Filtered | Unsupported {
  const rendered = renderAt(clip, { ...size, fps }, frame - clip.from, css);
  const filters: Filter[] = [];
  let backdrop = 0;
  for (const { out } of rendered) {
    backdrop += Number(BLUR_PX.exec(out.backdrop ?? '')?.[1] ?? 0);
    if (out.nodes.length) {
      if (unsupportedPrimitive(out.nodes)) {
        return Unsupported.Effect;
      }
      filters.push({ kind: FilterKind.Svg, nodes: out.nodes });
    }
    if (out.filter && !SVG_REF.test(out.filter)) {
      filters.push({ kind: FilterKind.Css, fns: cssFunctions(out.filter) });
    }
  }
  return { filters, backdrop };
}

const posed = (pose: Pose, w: number, h: number): Affine => mul2d([1, 0, 0, 1, pose.x * w, pose.y * h], scaleAbout(w / 2, h / 2, 0, pose.scale));

const scissorOf = (pose: Pose, w: number, h: number): Scissor | undefined => (pose.wipe > 0 ? [0, 0, w * (1 - pose.wipe), h] : undefined);

const scaleOf = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

export function prepare(doc: MotionDoc, tokens: BrandTokens, assets: Record<string, string> = {}, typeset: Typeset = NO_TYPESET): Prepared {
  return { doc: preparedDoc({ doc, tokens, assets }), tokens, assets, typeset };
}

export function drawFrame({ doc, tokens, assets, typeset }: Prepared, frame: number): DisplayList {
  const asset = (id: unknown) => (typeof id === 'string' && id ? (assets[id] ?? null) : null);
  const css = (v: string) => resolveColor(v, tokens);
  const colour = (v: string) => rgbaOf(css(v)) ?? [0, 0, 0, 1];
  const size = { width: doc.width, height: doc.height };
  const byId = new Map(doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const pairs = new Map(mattePairs(doc).map((p) => [p.target, p]));
  const sources = new Set([...pairs.values()].map((p) => p.source));
  const shown = (clip: MotionClip) => frame >= clip.from && frame < clip.from + clip.durationInFrames && !NO_PAINT.has(clip.component);

  function clipItems(clip: MotionClip): Item[] | Unsupported {
    const limit = CLIP_LIMITS.find(([, hit]) => hit(clip));
    if (limit) {
      return limit[0];
    }
    const painter = PAINTERS[clip.component]!;
    const props = propsAt(clip, frame, css);
    const { box, turn, opacity } = painter.place(props, size);
    const local = frame - clip.from;
    const painted = painter.paint({ clip, props, size: box, box, stage: size, unit: Math.min(size.width, size.height), colour, css, time: local / doc.fps, media: sourceSeconds(clip, local, doc.fps), fps: doc.fps, still: stillSeconds(doc), asset, logo: tokens.logoUrl, typeset });
    if (!Array.isArray(painted)) {
      return painted;
    }
    const edge = edgeAt(clip, frame);
    const world = mul2d(posed(edge, size.width, size.height), worldAt(doc, clip.id, frame, size));
    const masks = maskLayers(clip, frame, size, world, asset);
    const filtered = filtersOf(clip, frame, doc.fps, size, css);
    if (typeof filtered === 'string') {
      return filtered;
    }
    const pair = pairs.get(clip.id);
    const source = pair ? byId.get(pair.source) : undefined;
    const matteItems = source && shown(source) ? clipItems(source) : [];
    if (!masks || !Array.isArray(matteItems)) {
      return Unsupported.Mask;
    }
    const move = moveAt(clip, frame);
    const base = mul2d(mul2d(world, [1, 0, 0, 1, box.left, box.top]), turn);
    const moved = posed(move, box.width, box.height);
    const placed = mul2d(base, moved);
    const alpha = inheritedOpacity(doc, clip, byId, frame) * opacity * edge.opacity;
    const blur = blurOf(clip, frame) * scaleOf(placed) + edge.blur;
    const scissor = scissorOf(edge, size.width, size.height);
    const read = pair ? MATTE_READ[pair.matte] : null;
    const extras = { ...(scissor ? { scissor } : {}), ...(filtered.filters.length ? { filters: filtered.filters, space: [world[0], world[1], world[2], world[3]] as Linear } : {}), ...(filtered.backdrop ? { backdrop: filtered.backdrop } : {}), ...(masks.length ? { masks } : {}), ...(read ? { matte: { items: matteItems, luma: read.weights !== null, invert: read.invert } } : {}) };
    const framed = (c: Content) => (c.kind === ItemKind.Image && c.clipped ? { matrix: mul2d(base, c.matrix), inner: moved } : { matrix: mul2d(placed, c.matrix) });
    return painted.map((c) => ({ ...c, clip: clip.id, opacity: alpha * c.opacity, ...framed(c), blur, blend: clip.blend, ...extras }) as Item);
  }

  const items: Item[] = [];
  const unsupported: Gap[] = [];
  const bottomFirst = [...doc.tracks].reverse().filter((t) => t.kind === TrackKind.Visual && !t.hidden);
  for (const clip of bottomFirst.flatMap((t) => t.clips as MotionClip[])) {
    if (!shown(clip) || sources.has(clip.id)) {
      continue;
    }
    const drawn = clipItems(clip);
    if (Array.isArray(drawn)) {
      items.push(...drawn);
      continue;
    }
    unsupported.push({ clip: clip.id, component: clip.component, reason: drawn });
  }
  const background = doc.background === Background.Transparent ? null : colour('brand.background');
  return { ...size, background, items, unsupported };
}

export const displayListAt = (doc: MotionDoc, frame: number, tokens: BrandTokens, typeset: Typeset = NO_TYPESET): DisplayList => drawFrame(prepare(doc, tokens, {}, typeset), frame);
