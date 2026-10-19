import { resolveColor, type BrandTokens } from '../brand';
import { Background, type MotionClip, type MotionDoc } from '../doc';
import { TrackKind, type ComponentId } from '../components';
import { animProp, sampleColor, Source, TRANSFORM, ValueKind, type TransformKey } from '../keyframes';
import { sampleTrack } from '../sample-track';
import { IDENTITY, ParentOpacity, ancestorsOf, mul2d, transformAt, worldAt, type Affine } from '../parent';
import { boxOf } from '../layout';
import { preparedDoc } from '../hyperframes/compose';
import { EffectKind } from '../effects/registry';
import { BlendMode } from '../blend';
import { Matte } from '../mask';
import { TransitionKind } from '../design';
import { FillType, fillsOf, type Fill, type FillOf } from '../fill/model';
import { strokesOf } from '../stroke/model';
import { shapeLayers, type ShapeLook } from '../shape/render';
import { modifierFilter } from '../shape/modifiers';
import { ShapeKind, modifierValues } from '../shape/schema';
import { flatten, rectOutline, type Outline } from '../shape/geometry';
import { rgbaOf, type Rgba } from './rgba';

export enum ItemKind {
  Path = 'path'
}

export enum PaintKind {
  Solid = 'solid',
  Linear = 'linear',
  Radial = 'radial'
}

export enum FillRule {
  NonZero = 'nonzero',
  EvenOdd = 'evenodd'
}

export enum Unsupported {
  Component = 'component',
  Effect = 'effect',
  Mask = 'mask',
  Transition = 'transition',
  Blend = 'blend',
  Animator = 'animator',
  Shader = 'shader',
  Space3d = 'space-3d',
  Keyframe = 'keyframe',
  Move = 'move',
  Stroke = 'stroke',
  Modifier = 'modifier',
  Fill = 'fill',
  Pattern = 'pattern',
  ShapeKind = 'shape-kind'
}

export type Stop = { at: number; color: Rgba };

export type Paint =
  | { kind: PaintKind.Solid; color: Rgba }
  | { kind: PaintKind.Linear; from: [number, number]; to: [number, number]; stops: Stop[] }
  | { kind: PaintKind.Radial; center: [number, number]; radius: number; stops: Stop[] };

export type PathItem = { kind: ItemKind.Path; clip: string; contours: number[][]; rule: FillRule; paint: Paint; opacity: number; matrix: Affine; blur: number };

export type Item = PathItem;

export type Gap = { clip: string; component: ComponentId; reason: Unsupported };

export type DisplayList = { width: number; height: number; background: Rgba | null; items: Item[]; unsupported: Gap[] };

export type Prepared = { doc: MotionDoc; tokens: BrandTokens };

type Shape = { contours: number[][]; rule: FillRule; paint: Paint; opacity: number; matrix: Affine };
type Size = { width: number; height: number };
type Painted = Shape[] | Unsupported;
type Painter = (props: Record<string, unknown>, size: Size, colour: (v: string) => Rgba, frame: number) => Painted;

const NO_PAINT: ReadonlySet<ComponentId> = new Set(['Audio', 'Null', 'Precomp', 'Adjustment']);
const DRAWN_EFFECTS: ReadonlySet<string> = new Set([EffectKind.GaussianBlur]);
const DEPTH_KEYS: readonly TransformKey[] = ['z', 'rotateX', 'rotateY', 'skewX', 'skewY'];
const DRAWN_SOURCES: ReadonlySet<Source> = new Set([Source.Transform, Source.Prop, Source.Param]);
const NO_MOVE = 'none';
const SOLID_PATTERN = 'solid';
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

function shapePainter(props: Record<string, unknown>, size: Size, colour: (v: string) => Rgba, frame: number): Painted {
  const look = props as unknown as ShapeLook;
  const fills = fillsOf(props).filter((f) => f.visible);
  const stack = look.modifiers.filter((m) => m.enabled).map((m) => ({ kind: m.kind, values: modifierValues(m) }));
  const problems: [boolean, Unsupported][] = [
    [UNDRAWN_SHAPES.has(look.shape), Unsupported.ShapeKind],
    [strokesOf(props).some((s) => s.visible !== false), Unsupported.Stroke],
    [modifierFilter(stack, Math.min(size.width, size.height)) !== '', Unsupported.Modifier],
    [fills.some((f) => !PAINTS[f.type] || f.blend !== BlendMode.Normal), Unsupported.Fill]
  ];
  const problem = problems.find(([hit]) => hit);
  if (problem) {
    return problem[1];
  }
  const layers = shapeLayers(look, { w: size.width, h: size.height }, frame).filter((l) => l.outline.length);
  const rule = look.fillRule === FillRule.EvenOdd ? FillRule.EvenOdd : FillRule.NonZero;
  return fills.flatMap((f: Fill) => {
    const paint = (PAINTS[f.type] as (f: Fill, w: number, h: number, c: typeof colour) => Paint)(f, size.width, size.height, colour);
    return layers.map((l) => ({ contours: flat(l.outline), rule, paint, opacity: f.opacity * l.opacity, matrix: l.matrix as unknown as Affine }));
  });
}

function backgroundPainter(props: Record<string, unknown>, size: Size, colour: (v: string) => Rgba): Painted {
  if (props.pattern !== SOLID_PATTERN) {
    return Unsupported.Pattern;
  }
  return [{ contours: flat(rectOutline(0, { w: size.width, h: size.height })), rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: colour(String(props.fill)) }, opacity: Number(props.opacity ?? 1), matrix: IDENTITY }];
}

type Placement = (props: Record<string, unknown>, frame: Size) => { box: { left: number; top: number; width: number; height: number }; turn: Affine; opacity: number };

const fullFrame: Placement = (_props, frame) => ({ box: { left: 0, top: 0, ...frame }, turn: IDENTITY, opacity: 1 });

const boxed: Placement = (props, frame) => {
  const box = boxOf(props as never, frame);
  const turn = scaleAbout(box.width / 2, box.height / 2, Number(props.rotation ?? 0), Number(props.scale ?? 1));
  return { box, turn, opacity: Number(props.opacity ?? 1) };
};

const PAINTERS: Partial<Record<ComponentId, { place: Placement; paint: Painter }>> = {
  BrandBackground: { place: fullFrame, paint: backgroundPainter },
  Shape: { place: boxed, paint: shapePainter }
};

const keyed = (clip: MotionClip, keys: readonly string[]) => keys.some((k) => (clip.transform[k as TransformKey] ?? TRANSFORM[k as TransformKey].fallback) !== TRANSFORM[k as TransformKey].fallback || (clip.keyframes[k]?.length ?? 0) > 0);

const keyframedOutside = (clip: MotionClip) => Object.entries(clip.keyframes).some(([key, track]) => track.length > 0 && !DRAWN_SOURCES.has(animProp(clip.component, key)?.source as Source));

const CLIP_LIMITS: [Unsupported, (clip: MotionClip) => boolean][] = [
  [Unsupported.Component, (clip) => !PAINTERS[clip.component]],
  [Unsupported.Effect, (clip) => clip.effects.some((e) => e.enabled && !DRAWN_EFFECTS.has(e.kind))],
  [Unsupported.Mask, (clip) => Boolean(clip.mask) || clip.maskStack.length > 0 || clip.matte !== Matte.None],
  [Unsupported.Transition, (clip) => clip.transitionIn.kind !== TransitionKind.None || clip.transitionOut.kind !== TransitionKind.None],
  [Unsupported.Blend, (clip) => clip.blend !== BlendMode.Normal],
  [Unsupported.Animator, (clip) => clip.animators.length > 0],
  [Unsupported.Shader, (clip) => clip.shaders.length > 0],
  [Unsupported.Space3d, (clip) => keyed(clip, DEPTH_KEYS)],
  [Unsupported.Keyframe, keyframedOutside],
  [Unsupported.Move, (clip) => (clip.props.move ?? NO_MOVE) !== NO_MOVE]
];

function propsAt(clip: MotionClip, frame: number, colour: (v: string) => string): Record<string, unknown> {
  const local = frame - clip.from;
  const sampled = Object.entries(clip.keyframes).flatMap(([key, track]) => {
    const prop = animProp(clip.component, key);
    if (!prop || prop.source === Source.Transform || !track.length) {
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

function blurOf(clip: MotionClip, frame: number): number {
  const effects = clip.effects.filter((e) => e.enabled && e.kind === EffectKind.GaussianBlur).reduce((sum, e) => sum + Number(e.params.radius ?? 0), 0);
  return transformAt(clip, 'blur', frame) + effects;
}

const scaleOf = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

export function prepare(doc: MotionDoc, tokens: BrandTokens): Prepared {
  return { doc: preparedDoc({ doc, tokens, assets: {} }), tokens };
}

export function drawFrame({ doc, tokens }: Prepared, frame: number): DisplayList {
  const css = (v: string) => resolveColor(v, tokens);
  const colour = (v: string) => rgbaOf(css(v)) ?? [0, 0, 0, 1];
  const size = { width: doc.width, height: doc.height };
  const byId = new Map(doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const items: Item[] = [];
  const unsupported: Gap[] = [];
  const bottomFirst = [...doc.tracks].reverse().filter((t) => t.kind === TrackKind.Visual && !t.hidden);
  for (const track of bottomFirst) {
    for (const clip of track.clips as MotionClip[]) {
      if (frame < clip.from || frame >= clip.from + clip.durationInFrames || NO_PAINT.has(clip.component)) {
        continue;
      }
      const limit = CLIP_LIMITS.find(([, hit]) => hit(clip));
      if (limit) {
        unsupported.push({ clip: clip.id, component: clip.component, reason: limit[0] });
        continue;
      }
      const painter = PAINTERS[clip.component]!;
      const props = propsAt(clip, frame, css);
      const { box, turn, opacity } = painter.place(props, size);
      const painted = painter.paint(props, box, colour, (frame - clip.from) / doc.fps);
      if (!Array.isArray(painted)) {
        unsupported.push({ clip: clip.id, component: clip.component, reason: painted });
        continue;
      }
      const placed = mul2d(mul2d(worldAt(doc, clip.id, frame, size), [1, 0, 0, 1, box.left, box.top]), turn);
      const alpha = inheritedOpacity(doc, clip, byId, frame) * opacity;
      const blur = blurOf(clip, frame) * scaleOf(placed);
      items.push(...painted.map((s): PathItem => ({ kind: ItemKind.Path, clip: clip.id, contours: s.contours, rule: s.rule, paint: s.paint, opacity: alpha * s.opacity, matrix: mul2d(placed, s.matrix), blur })));
    }
  }
  const background = doc.background === Background.Transparent ? null : colour('brand.background');
  return { ...size, background, items, unsupported };
}

export const displayListAt = (doc: MotionDoc, frame: number, tokens: BrandTokens): DisplayList => drawFrame(prepare(doc, tokens), frame);
