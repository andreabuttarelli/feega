import { FrameKind } from '$lib/canvas/motion-node';
import { compOf, findClip, MotionFormat, type MotionDoc } from '@feega/motion-core/motion/doc';
import { blankElement, canvasReady, drawClip, drawnFrame, penClip } from '$lib/motion/draw-create';
import { DrawTool } from '$lib/motion/draw-tool';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import type { Effect } from '@feega/motion-core/motion/effects/model';
import { TYPE_SIZE } from '@feega/motion-core/motion/components';
import { FillType, MAX_STOPS } from '@feega/motion-core/motion/fill/model';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { registerFont, registerUpload } from '$lib/motion/fonts/ops';
import type { FontVariant } from '@feega/motion-core/motion/fonts/model';
import { groupClips } from '$lib/motion/group';
import { createComponent, innerClips } from '$lib/motion/main-component';
import { precompose } from '@feega/motion-core/motion/precomp';
import { instanceOverrides } from './instance-diff';
import { Align, Direction, Justify as MotionJustify, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { setAutoLayout, setLayoutItem } from '$lib/motion/layout/ops';
import { setParent } from '$lib/motion/parent-ops';
import { mapOutline, parsePath, type Pt } from '@feega/motion-core/motion/shape/geometry';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import { addClip, editClip, setProps, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { figmaMessage, type FigmaMessage } from './archive';
import { Clip, Cross, Decoration, Destination, Fit, FillKind, Flow, Justify, LayerKind, PictureFit, figmaScene, type AutoLayout, type ComponentRef, type Fill, type FrameLayer, type Blur, type Layer, type LayerEffect, type Shadow, type ShapeLayer, type Stroke, type TextLayer } from './scene';

type NewId = () => string;
type Unit = { x: number; y: number };
type Size = { width: number; height: number };
type Root = { id: string; layer: Layer };
type Built = { doc: MotionDoc; ids: string[]; roots: Root[] };
export type FigmaImage = { clipId: string; hash: string; at: number; innerId?: string; fit?: PictureFit; focus?: Unit };
type Main = { compId: string; at: Unit; images: FigmaImage[] };
type Place = { centre: Unit; scale: number; frame: number; newId: NewId; report: (what: string) => void; rootSize: Size; images: FigmaImage[]; mains: Map<string, Main>; texts: Map<Layer, string> };

export type PlanItem = { destination: Destination; doc: MotionDoc; size: Size; centre: Unit; name: string; kind: FrameKind; images: FigmaImage[] };
export type FigmaPlan = { items: PlanItem[]; skipped: string[]; fileKey: string | null };
export type FontUpload = { family: string; variants: FontVariant[] };
export type FigmaPasted = { doc: MotionDoc; selection: string[]; skipped: string[]; images: FigmaImage[]; fileKey: string | null };

const IMAGE_PLACEHOLDER = '#d9d9d9';
const DIGITS = 10000;
const MAX_NAME = 60;
const SHADOW_DISTANCE_LIMIT = 300;
const MAX_STROKE_WIDTH = 0.2;
const MIN_STOPS = 2;
const MIN_TEXT_BOX: Unit = { x: 0.02, y: 0.002 };
const CENTRE: Unit = { x: 0.5, y: 0.5 };

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const minSide = (doc: MotionDoc) => Math.min(doc.width, doc.height);

const toUnit = (doc: MotionDoc, p: Place) => ([x, y]: Pt): Pt => [(p.centre.x * doc.width + (x - p.rootSize.width / 2) * p.scale) / doc.width, (p.centre.y * doc.height + (y - p.rootSize.height / 2) * p.scale) / doc.height];

type Painted = Record<string, unknown>;

function fewest<T>(stops: T[]): T[] {
  if (stops.length <= MAX_STOPS) {
    return stops;
  }
  return Array.from({ length: MAX_STOPS }, (_, i) => stops[Math.round((i * (stops.length - 1)) / (MAX_STOPS - 1))]);
}

const withStops = (f: Extract<Fill, { stops: unknown }>, make: (stops: typeof f.stops) => Painted): Painted | null => (f.stops.length >= MIN_STOPS ? make(fewest(f.stops)) : null);

const MOTION_FILL: Record<FillKind, (f: Fill) => Painted | null> = {
  [FillKind.Solid]: (f) => ({ type: FillType.Solid, color: (f as Extract<Fill, { kind: FillKind.Solid }>).color, opacity: f.opacity }),
  [FillKind.Image]: (f) => ({ type: FillType.Solid, color: IMAGE_PLACEHOLDER, opacity: f.opacity }),
  [FillKind.Linear]: (f) => withStops(f as Extract<Fill, { kind: FillKind.Linear }>, (stops) => ({ type: FillType.Linear, stops, angle: (f as Extract<Fill, { kind: FillKind.Linear }>).angle, opacity: f.opacity })),
  [FillKind.Radial]: (f) => {
    const radial = f as Extract<Fill, { kind: FillKind.Radial }>;
    return withStops(radial, (stops) => ({ type: FillType.Radial, stops, center: radial.center, radius: radial.radius, opacity: f.opacity }));
  },
  [FillKind.Angular]: (f) => {
    const angular = f as Extract<Fill, { kind: FillKind.Angular }>;
    return withStops(angular, (stops) => ({ type: FillType.Angular, stops, angle: angular.angle, center: angular.center, opacity: f.opacity }));
  },
  [FillKind.Diamond]: (f) => withStops(f as Extract<Fill, { kind: FillKind.Diamond }>, (stops) => ({ type: FillType.Diamond, stops, opacity: f.opacity }))
};

const fillStack = (fills: Fill[]): Painted[] => fills.map((f) => MOTION_FILL[f.kind](f)).filter((p): p is Painted => p !== null);

function imageSlots(fills: Fill[]): Omit<FigmaImage, 'clipId'>[] {
  const painted = fills.filter((f) => MOTION_FILL[f.kind](f));
  return painted.flatMap((f, at) => (f.kind === FillKind.Image ? [{ hash: f.hash, at, fit: f.fit, focus: f.focus }] : []));
}

function strokeStack(strokes: Stroke[], doc: MotionDoc, p: Place): Painted[] {
  return strokes.flatMap((s) => {
    const paint = MOTION_FILL[s.fill.kind](s.fill);
    return paint ? [{ paint, width: clamp(round((s.weight * p.scale) / minSide(doc)), 0, MAX_STROKE_WIDTH), align: s.align }] : [];
  });
}

const paintOf = (layer: { fills: Fill[]; strokes: Stroke[] }, doc: MotionDoc, p: Place): Painted => ({ fills: fillStack(layer.fills), strokes: strokeStack(layer.strokes, doc, p) });

const px = (n: number, p: Place) => clamp(Math.round(n * p.scale), -SHADOW_DISTANCE_LIMIT, SHADOW_DISTANCE_LIMIT);

const shadow = (e: LayerEffect) => e as Shadow;
const blurRadius = (e: LayerEffect, p: Place) => clamp(px((e as Blur).radius, p) / 2, 0, 200);

const EFFECT: Record<LayerEffect['kind'], (e: LayerEffect, p: Place) => Omit<Effect, 'id' | 'enabled'>> = {
  'drop-shadow': (e, p) => {
    const s = shadow(e);
    return { kind: EffectKind.DropShadow, params: { distance: 0, x: px(s.x, p), y: px(s.y, p), blur: clamp(px(s.blur, p), 0, 200), spread: clamp(px(s.spread, p), -100, 100), color: s.color, opacity: s.opacity } };
  },
  'inner-shadow': (e, p) => {
    const s = shadow(e);
    return { kind: EffectKind.InnerShadow, params: { distance: px(Math.hypot(s.x, s.y), p), angle: Math.round((Math.atan2(s.y, s.x) * 180) / Math.PI), blur: clamp(px(s.blur, p), 0, 200), color: s.color, opacity: s.opacity } };
  },
  'layer-blur': (e, p) => ({ kind: EffectKind.GaussianBlur, params: { radius: blurRadius(e, p) } }),
  'background-blur': (e, p) => ({ kind: EffectKind.BackgroundBlur, params: { radius: blurRadius(e, p) } })
};

function finished(made: OpResult, id: string, layer: Layer, p: Place, props: Record<string, unknown>): OpResult {
  if (!made.ok) {
    return made;
  }
  const turned = layer.rotation ? { rotation: layer.rotation } : {};
  const styled = setProps(made.doc, id, { ...props, ...turned, ...(layer.opacity < 1 ? { opacity: layer.opacity } : {}) });
  if (!styled.ok) {
    p.report(`style of ${layer.name}: ${styled.error}`);
  }
  const effects = layer.effects.map((e, i): Effect => ({ id: `fx${i + 1}`, enabled: true, ...EFFECT[e.kind](e, p) }));
  return editClip(styled.ok ? styled.doc : made.doc, id, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME), ...(effects.length ? { effects } : {}) }));
}

type Outlined = { name: string; path: string; fillRule: string; fills: Fill[]; strokes: Stroke[] } & Pick<Layer, 'opacity' | 'effects' | 'rotation'>;

function shapeClip(doc: MotionDoc, layer: Outlined, p: Place): Built {
  const outline = parsePath(layer.path);
  if (typeof outline === 'string') {
    p.report(`path of ${layer.name}`);
    return { doc, ids: [], roots: [] };
  }
  const id = p.newId();
  const made = finished(penClip(doc, mapOutline(outline, toUnit(doc, p)), p.frame, id, {}), id, layer as Layer, p, { ...paintOf(layer, doc, p), fillRule: layer.fillRule });
  if (!made.ok) {
    p.report(`${layer.name}: ${made.error}`);
    return { doc, ids: [], roots: [] };
  }
  p.images.push(...imageSlots(layer.fills).map((slot) => ({ clipId: id, ...slot })));
  return { doc: made.doc, ids: [id], roots: [{ id, layer: layer as Layer }] };
}

function withFont(doc: MotionDoc, family: string, p: Place): { doc: MotionDoc; font: string | null } {
  if (doc.fonts.some((f) => f.family === family)) {
    return { doc, font: family };
  }
  const registered = registerFont(doc, family, GOOGLE_FONTS);
  if (!registered.ok) {
    p.report(`font ${family} replaced by the default`);
    return { doc, font: null };
  }
  return { doc: registered.doc, font: registered.doc.fonts.find((f) => f.family.toLowerCase() === family.toLowerCase())?.family ?? family };
}

function withUploads(doc: MotionDoc, uploads: readonly FontUpload[], skipped: Set<string>): MotionDoc {
  let next = doc;
  for (const upload of uploads) {
    const made = registerUpload(next, upload);
    if (!made.ok) {
      skipped.add(`font ${upload.family}: ${made.error}`);
      continue;
    }
    next = made.doc;
  }
  return next;
}

const PIXELS = /^(-?\d+(?:\.\d+)?)px$/;

const scaledPixels = (measure: string, p: Place) => {
  const px = measure.match(PIXELS);
  return px ? `${round(Number(px[1]) * p.scale)}px` : measure;
};

function textClip(doc: MotionDoc, layer: TextLayer, p: Place): Built {
  const fonts = [layer.font, ...layer.runs.flatMap((r) => (r.font ? [r.font] : []))];
  let next = doc;
  const known = new Map<string, string | null>();
  for (const family of new Set(fonts)) {
    const got = withFont(next, family, p);
    next = got.doc;
    known.set(family, got.font);
  }
  const [x0, y0] = toUnit(next, p)([layer.box.x, layer.box.y]);
  const [x1, y1] = toUnit(next, p)([layer.box.x + layer.box.width, layer.box.y + layer.box.height]);
  const [width, height] = [Math.max(x1 - x0, MIN_TEXT_BOX.x), Math.max(y1 - y0, MIN_TEXT_BOX.y)];
  const id = p.newId();
  const drawn = drawClip(next, DrawTool.Text, { x: x0 + width / 2, y: y0 + height / 2, width, height }, p.frame, id, layer.wraps ? TextSizing.AutoHeight : TextSizing.AutoWidth, { text: layer.text });
  const size = (n: number) => clamp(round((n * p.scale) / minSide(next)), TYPE_SIZE.min, TYPE_SIZE.max);
  const font = known.get(layer.font);
  const runs = layer.runs.map(({ font: f, size: s, ...rest }) => ({ ...rest, ...(f && known.get(f) ? { font: f } : {}), ...(s ? { size: size(s) } : {}) }));
  const stacked = layer.fills.length > 1 || layer.fills.some((f) => f.kind !== FillKind.Solid || f.opacity < 1);
  const look = {
    text: layer.text,
    color: layer.color,
    ...(stacked ? { fills: fillStack(layer.fills) } : {}),
    ...(layer.strokes.length ? { strokes: strokeStack(layer.strokes, next, p) } : {}),
    ...(font ? { font } : {}),
    weight: layer.weight,
    italic: layer.italic,
    size: size(layer.size),
    letterSpacing: scaledPixels(layer.letterSpacing, p),
    lineHeight: scaledPixels(layer.lineHeight, p),
    align: layer.align,
    verticalAlign: 'top',
    ...(layer.decoration === Decoration.None ? {} : { decoration: layer.decoration }),
    ...(layer.axes ? { axes: layer.axes } : {}),
    ...(layer.features ? { features: layer.features } : {}),
    ...(runs.length ? { runs } : {})
  };
  const styled = finished(drawn, id, layer, p, look);
  const { runs: _runs, font: _font, ...plain } = look as typeof look & { font?: string };
  const made = styled.ok ? styled : finished(drawn, id, layer, p, plain);
  if (!made.ok) {
    p.report(`${layer.name}: ${made.error}`);
    return { doc, ids: [], roots: [] };
  }
  p.texts.set(layer, id);
  return { doc: made.doc, ids: [id], roots: [{ id, layer }] };
}

enum Background {
  IfPainted = 'if-painted',
  Always = 'always'
}

const NOTHING_TO_DRAW: Record<Background, (layer: FrameLayer) => boolean> = {
  [Background.IfPainted]: (layer) => !layer.fills.length && !layer.strokes.length,
  [Background.Always]: () => false
};

function frameBackground(doc: MotionDoc, layer: FrameLayer, p: Place, need: Background): Built {
  if (NOTHING_TO_DRAW[need](layer)) {
    return { doc, ids: [], roots: [] };
  }
  const drawn = shapeClip(doc, { name: layer.name, path: layer.outline, fillRule: 'nonzero', fills: layer.fills, strokes: layer.strokes, opacity: 1, effects: layer.effects, rotation: 0 }, p);
  return { ...drawn, roots: drawn.roots.map((r) => ({ ...r, layer })) };
}

const BUILD: Record<LayerKind, (doc: MotionDoc, layer: Layer, p: Place) => Built> = {
  [LayerKind.Shape]: (doc, layer, p) => shapeClip(doc, layer as ShapeLayer, p),
  [LayerKind.Text]: (doc, layer, p) => textClip(doc, layer as TextLayer, p),
  [LayerKind.Frame]: (doc, layer, p) => nestedFrame(doc, layer as FrameLayer, p, Background.IfPainted)
};

const BUILD_IN_FLOW: Record<LayerKind, (doc: MotionDoc, layer: Layer, p: Place) => Built> = {
  ...BUILD,
  [LayerKind.Frame]: (doc, layer, p) => nestedFrame(doc, layer as FrameLayer, p, Background.Always)
};

const DIRECTION: Record<Flow, Direction> = { [Flow.Row]: Direction.Horizontal, [Flow.Column]: Direction.Vertical };

const MOTION_JUSTIFY: Record<Justify, MotionJustify> = {
  [Justify.Start]: MotionJustify.Start,
  [Justify.Center]: MotionJustify.Center,
  [Justify.End]: MotionJustify.End,
  [Justify.SpaceBetween]: MotionJustify.SpaceBetween,
  [Justify.SpaceAround]: MotionJustify.SpaceAround,
  [Justify.SpaceEvenly]: MotionJustify.SpaceEvenly
};

const MOTION_ALIGN: Record<Cross, Align> = { [Cross.Start]: Align.Start, [Cross.Center]: Align.Center, [Cross.End]: Align.End, [Cross.Baseline]: Align.Baseline };

const FIT: Record<Fit, Sizing> = { [Fit.Fixed]: Sizing.Fixed, [Fit.Hug]: Sizing.Hug };

type Step = (doc: MotionDoc) => OpResult;

function applied(doc: MotionDoc, steps: Step[], p: Place, what: string): MotionDoc {
  let next = doc;
  for (const step of steps) {
    const made = step(next);
    if (!made.ok) {
      p.report(`${what}: ${made.error}`);
      continue;
    }
    next = made.doc;
  }
  return next;
}

const scaled = (n: number, p: Place) => Math.round(n * p.scale * 100) / 100;

function flowOf(flow: AutoLayout, p: Place) {
  const { top, right, bottom, left } = flow.padding;
  return {
    direction: DIRECTION[flow.flow],
    wrap: flow.wrap,
    gap: scaled(flow.gap, p),
    crossGap: scaled(flow.crossGap, p),
    padding: { top: scaled(top, p), right: scaled(right, p), bottom: scaled(bottom, p), left: scaled(left, p) },
    justify: MOTION_JUSTIFY[flow.justify],
    align: MOTION_ALIGN[flow.align]
  };
}

function itemFor(child: Layer, parent: AutoLayout): Partial<{ width: Sizing; height: Sizing; absolute: boolean }> {
  const row = parent.flow === Flow.Row;
  const fillsWidth = row ? child.item.grow : child.item.stretch;
  const fillsHeight = row ? child.item.stretch : child.item.grow;
  return {
    ...(child.kind === LayerKind.Text ? (child.wraps ? { height: Sizing.Hug } : { width: Sizing.Hug, height: Sizing.Hug }) : {}),
    ...(fillsWidth ? { width: Sizing.Fill } : {}),
    ...(fillsHeight ? { height: Sizing.Fill } : {}),
    ...(child.item.absolute ? { absolute: true } : {})
  };
}

function laidOut(built: Built, container: Root, layer: FrameLayer, flow: AutoLayout, p: Place): Built {
  const own: Step[] = [(d) => setAutoLayout(d, container.id, flowOf(flow, p)), (d) => setLayoutItem(d, container.id, { width: FIT[flow.width], height: FIT[flow.height] })];
  const kids = built.roots.filter((r) => r.id !== container.id);
  const children = kids.flatMap((kid): Step[] => [(d) => setParent(d, kid.id, container.id, { at: p.frame }), (d) => setLayoutItem(d, kid.id, itemFor(kid.layer, flow))]);
  const clipped: Step[] = layer.clip === Clip.Content ? [(d) => editClip(d, container.id, (c) => ({ ...c, clipContent: true }))] : [];
  const doc = applied(built.doc, [...own, ...children, ...clipped], p, `auto layout of ${layer.name}`);
  return { ...built, doc: faded(doc, [container.id], layer.opacity, p), roots: [container] };
}

function clipped(built: Built, container: Root, layer: FrameLayer, p: Place): Built {
  const kids = built.roots.filter((r) => r.id !== container.id);
  const steps: Step[] = [...kids.map((kid): Step => (d) => setParent(d, kid.id, container.id, { at: p.frame })), (d) => editClip(d, container.id, (c) => ({ ...c, clipContent: true }))];
  const doc = applied(built.doc, steps, p, `clip of ${layer.name}`);
  return { ...built, doc, roots: [container] };
}

const holds = (layer: FrameLayer) => Boolean(layer.autoLayout) || layer.clip === Clip.Content;

function layersOf(doc: MotionDoc, layer: FrameLayer, p: Place, need = Background.IfPainted): Built {
  const flow = layer.autoLayout;
  const background = frameBackground(doc, layer, p, holds(layer) ? Background.Always : need);
  const build = flow ? BUILD_IN_FLOW : BUILD;
  let built: Built = { ...background, roots: holds(layer) ? [] : background.roots };
  for (const child of layer.children) {
    const next = build[child.kind](built.doc, child, p);
    built = { doc: next.doc, ids: [...built.ids, ...next.ids], roots: [...built.roots, ...next.roots] };
  }
  const [container] = background.roots;
  if (!container || !holds(layer)) {
    return built;
  }
  const all = { ...built, roots: [container, ...built.roots] };
  return flow ? laidOut(all, container, layer, flow, p) : clipped(all, container, layer, p);
}

const OPAQUE = 1;

function faded(doc: MotionDoc, ids: string[], opacity: number, p: Place): MotionDoc {
  if (opacity >= OPAQUE) {
    return doc;
  }
  return applied(doc, ids.map((id): Step => (d) => setTransform(d, id, { opacity: round(opacity * Number(findClip(d, id)?.clip.transform?.opacity ?? OPAQUE)) })), p, 'opacity');
}

function grouped(built: Built, layer: FrameLayer, p: Place): Built {
  if (built.ids.length < 2) {
    return { ...built, doc: faded(built.doc, built.ids, layer.opacity, p) };
  }
  const groupId = p.newId();
  let n = 0;
  const made = groupClips(built.doc, built.ids, () => (n++ === 0 ? p.newId() : groupId));
  if (!made.ok) {
    return built;
  }
  const named = editClip(made.doc, groupId, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME), ...(layer.clip === Clip.Content ? { clipContent: true } : {}) }));
  return { doc: faded(named.ok ? named.doc : made.doc, [groupId], layer.opacity, p), ids: [groupId], roots: [{ id: groupId, layer }] };
}

function clipIdsIn(doc: MotionDoc, compId: string): string[] {
  const clips = (doc.comps[compId]?.tracks ?? []).flatMap((t) => t.clips);
  return clips.flatMap((c) => [c.id, ...(compOf(c) ? clipIdsIn(doc, compOf(c)!) : [])]);
}

const textsIn = (layer: Layer): TextLayer[] => (layer.kind === LayerKind.Text ? [layer] : layer.kind === LayerKind.Frame ? layer.children.flatMap(textsIn) : []);

const MAX_PROPERTY = 40;

function propertiesOf(doc: MotionDoc, compId: string, layer: FrameLayer, component: ComponentRef, p: Place) {
  const direct = new Set(innerClips(doc.comps[compId]).map((c) => c.id));
  const texts = textsIn(layer);
  const found = Object.entries(component.texts ?? {}).flatMap(([prop, value]) => {
    const text = texts.find((t) => t.text.trim() === value.trim());
    const target = text ? p.texts.get(text) : undefined;
    return target && direct.has(target) && prop.length <= MAX_PROPERTY ? [[prop, { kind: 'text' as const, target, default: value }]] : [];
  });
  return found.length ? { properties: Object.fromEntries(found) } : {};
}

function mainFrom(built: Built, layer: FrameLayer, component: ComponentRef, p: Place): Built {
  const ids = { comp: p.newId(), clip: p.newId() };
  let n = 0;
  const made = createComponent(built.doc, built.ids, () => (n++ === 0 ? ids.comp : ids.clip), component.name);
  if (!made.ok) {
    return grouped(built, layer, p);
  }
  const inside = new Set(clipIdsIn(made.doc, ids.comp));
  p.mains.set(component.key, { compId: ids.comp, at: { x: layer.box.x, y: layer.box.y }, images: p.images.filter((i) => inside.has(i.clipId)) });
  const comp = made.doc.comps[ids.comp];
  const marks = { ...(component.variant ? { set: component.name, variant: component.variant } : {}), ...propertiesOf(made.doc, ids.comp, layer, component, p) };
  const varied = Object.keys(marks).length ? { ...made.doc, comps: { ...made.doc.comps, [ids.comp]: { ...comp, component: { ...comp.component!, ...marks } } } } : made.doc;
  const named = editClip(varied, ids.clip, (clip) => ({ ...clip, name: component.name.slice(0, MAX_NAME) }));
  return { doc: named.ok ? named.doc : varied, ids: [ids.clip], roots: [{ id: ids.clip, layer }] };
}

function ownOverrides(doc: MotionDoc, layer: FrameLayer, main: Main, shift: Unit, p: Place) {
  const images: FigmaImage[] = [];
  const own = layersOf(doc, layer, { ...p, centre: { x: p.centre.x - shift.x, y: p.centre.y - shift.y }, images, mains: new Map(p.mains), report: () => undefined }, Background.Always);
  const ids = { comp: p.newId(), clip: p.newId() };
  const made = own.ids.length ? precompose(own.doc, own.ids, ids, layer.name) : null;
  return made?.ok ? instanceOverrides(made.doc, ids.comp, main.compId, { own: images, main: main.images }) : null;
}

function instanceOfMain(doc: MotionDoc, layer: FrameLayer, main: Main, p: Place, need: Background): Built {
  const shift = { x: ((layer.box.x - main.at.x) * p.scale) / doc.width, y: ((layer.box.y - main.at.y) * p.scale) / doc.height };
  const linked = ownOverrides(doc, layer, main, shift, p);
  if (!linked) {
    return plainFrame(doc, layer, p, need);
  }
  const id = p.newId();
  const comp = doc.comps[main.compId];
  const overrides = Object.keys(linked.overrides).length ? { overrides: linked.overrides } : {};
  const added = addClip(doc, { component: 'Precomp', from: 0, durationInFrames: Math.min(comp.durationInFrames, doc.durationInFrames), props: { comp: main.compId, ...overrides } }, id);
  const moved = added.ok ? setTransform(added.doc, id, shift) : added;
  const named = moved.ok ? editClip(moved.doc, id, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME) })) : moved;
  if (!named.ok) {
    p.report(`${layer.name}: ${named.error}`);
    return { doc, ids: [], roots: [] };
  }
  p.images.push(...linked.images.map((i) => ({ ...i, clipId: id })));
  return { doc: named.doc, ids: [id], roots: [{ id, layer }] };
}

function plainFrame(doc: MotionDoc, layer: FrameLayer, p: Place, need: Background): Built {
  const built = layersOf(doc, layer, p, need);
  return layer.autoLayout ? built : grouped(built, layer, p);
}

function nestedFrame(doc: MotionDoc, layer: FrameLayer, p: Place, need: Background): Built {
  const main = layer.component?.inPaste ? p.mains.get(layer.component.key) : undefined;
  if (main) {
    return instanceOfMain(doc, layer, main, p, need);
  }
  if (layer.component?.inPaste) {
    return mainFrom(layersOf(doc, layer, p, Background.Always), layer, layer.component, p);
  }
  return plainFrame(doc, layer, p, need);
}

function sceneOf(html: string) {
  const message = figmaMessage(html);
  const scene = message ? figmaScene(message) : null;
  return scene && message ? { scene, fileKey: message.meta.fileKey ?? null } : null;
}

const wholeSize = (size: Size): Size => ({ width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) });

function frameItem(layer: FrameLayer, centre: Unit, newId: NewId, skipped: Set<string>, uploads: readonly FontUpload[]): PlanItem {
  const size = wholeSize(layer.box);
  const blank = withUploads(drawnFrame({ left: 0, top: 0, ...size }, MotionFormat.Custom, 0), uploads, skipped);
  const images: FigmaImage[] = [];
  const place: Place = { centre: CENTRE, scale: blank.width / layer.box.width, frame: 0, newId, report: (w) => skipped.add(w), rootSize: layer.box, images, mains: new Map(), texts: new Map() };
  const built = layersOf(blank, { ...layer, clip: Clip.None }, place);
  return { destination: Destination.Frame, doc: built.doc, size, centre, name: layer.name, kind: FrameKind.Frame, images };
}

function freeItem(layer: Layer, size: Size, centre: Unit, newId: NewId, skipped: Set<string>, uploads: readonly FontUpload[]): PlanItem | null {
  const fit = wholeSize(size);
  const empty = blankElement({ left: 0, top: 0, ...fit });
  if (!empty.ok) {
    skipped.add(`${layer.name}: ${empty.error}`);
    return null;
  }
  const blank = { ...empty, doc: withUploads(empty.doc, uploads, skipped) };
  const images: FigmaImage[] = [];
  const place: Place = { centre: CENTRE, scale: blank.doc.width / size.width, frame: 0, newId, report: (w) => skipped.add(w), rootSize: size, images, mains: new Map(), texts: new Map() };
  const built = BUILD[layer.kind](blank.doc, layer, place);
  const one = layer.kind === LayerKind.Frame ? grouped(built, layer, place) : built;
  const first = one.doc.tracks.flatMap((t) => t.clips)[0];
  if (!first) {
    return null;
  }
  const kind = compOf(first) ? FrameKind.Group : FrameKind.Element;
  return { destination: Destination.Free, doc: canvasReady(one.doc), size: fit, centre, name: layer.name, kind, images };
}

export function figmaPlan(html: string, newId: NewId): FigmaPlan | null {
  const message = figmaMessage(html);
  return message ? planOf(message, newId) : null;
}

const isStage = (layer: Layer, destination: Destination): layer is FrameLayer => layer.kind === LayerKind.Frame && destination === Destination.Frame && layer.fills.length > 0;

export function planOf(message: FigmaMessage, newId: NewId, uploads: readonly FontUpload[] = []): FigmaPlan | null {
  const scene = figmaScene(message);
  if (!scene) {
    return null;
  }
  const skipped = new Set(scene.skipped);
  const items = scene.placements.flatMap((pl) => {
    const made = isStage(pl.layer, pl.destination) ? frameItem(pl.layer, pl.centre, newId, skipped, uploads) : freeItem(pl.layer, pl.size, pl.centre, newId, skipped, uploads);
    return made ? [made] : [];
  });
  return items.length ? { items, skipped: [...skipped], fileKey: message.meta.fileKey ?? null } : null;
}

export function figmaIntoFrame(doc: MotionDoc, html: string, at: Unit, scale: number, frame: number, newId: NewId): FigmaPasted | null {
  const found = sceneOf(html);
  if (!found) {
    return null;
  }
  const { scene, fileKey } = found;
  const skipped = new Set(scene.skipped);
  const images: FigmaImage[] = [];
  const place: Place = { centre: at, scale, frame, newId, report: (w) => skipped.add(w), rootSize: scene.combined.box, images, mains: new Map(), texts: new Map() };
  const built = grouped(layersOf(doc, scene.combined, place), scene.combined, place);
  return built.ids.length ? { doc: built.doc, selection: built.ids, skipped: [...skipped], images, fileKey } : null;
}
