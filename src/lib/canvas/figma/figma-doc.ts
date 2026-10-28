import { FrameKind } from '$lib/canvas/motion-node';
import { compOf, MotionFormat, type MotionDoc } from '@feega/motion-core/motion/doc';
import { blankElement, canvasReady, drawClip, drawnFrame, penClip } from '$lib/motion/draw-create';
import { DrawTool } from '$lib/motion/draw-tool';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import type { Effect } from '@feega/motion-core/motion/effects/model';
import { TYPE_SIZE } from '@feega/motion-core/motion/components';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { registerFont } from '$lib/motion/fonts/ops';
import { groupClips } from '$lib/motion/group';
import { createComponent } from '$lib/motion/main-component';
import { Align, Direction, Justify as MotionJustify, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { setAutoLayout, setLayoutItem } from '$lib/motion/layout/ops';
import { setParent } from '$lib/motion/parent-ops';
import { mapOutline, parsePath, type Pt } from '@feega/motion-core/motion/shape/geometry';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import { addClip, editClip, setProps, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { figmaMessage, type FigmaMessage } from './archive';
import { Clip, Cross, Destination, Fit, FillKind, Flow, Justify, LayerKind, figmaScene, type AutoLayout, type ComponentRef, type Fill, type FrameLayer, type Blur, type Layer, type LayerEffect, type Shadow, type ShapeLayer, type Stroke, type TextLayer } from './scene';

type NewId = () => string;
type Unit = { x: number; y: number };
type Size = { width: number; height: number };
type Root = { id: string; layer: Layer };
type Built = { doc: MotionDoc; ids: string[]; roots: Root[] };
export type FigmaImage = { clipId: string; hash: string; at: number };
type Main = { compId: string; at: Unit };
type Place = { centre: Unit; scale: number; frame: number; newId: NewId; report: (what: string) => void; rootSize: Size; images: FigmaImage[]; mains: Map<string, Main> };

export type PlanItem = { destination: Destination; doc: MotionDoc; size: Size; centre: Unit; name: string; kind: FrameKind; images: FigmaImage[] };
export type FigmaPlan = { items: PlanItem[]; skipped: string[]; fileKey: string | null };
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

const withStops = (f: Extract<Fill, { stops: unknown }>, make: (stops: typeof f.stops) => Painted): Painted | null => (f.stops.length >= MIN_STOPS ? make(f.stops) : null);

const MOTION_FILL: Record<FillKind, (f: Fill) => Painted | null> = {
  [FillKind.Solid]: (f) => ({ type: FillType.Solid, color: (f as Extract<Fill, { kind: FillKind.Solid }>).color, opacity: f.opacity }),
  [FillKind.Image]: (f) => ({ type: FillType.Solid, color: IMAGE_PLACEHOLDER, opacity: f.opacity }),
  [FillKind.Linear]: (f) => withStops(f as Extract<Fill, { kind: FillKind.Linear }>, (stops) => ({ type: FillType.Linear, stops, angle: (f as Extract<Fill, { kind: FillKind.Linear }>).angle, opacity: f.opacity })),
  [FillKind.Radial]: (f) => withStops(f as Extract<Fill, { kind: FillKind.Radial }>, (stops) => ({ type: FillType.Radial, stops, center: CENTRE, radius: 1, opacity: f.opacity })),
  [FillKind.Angular]: (f) => {
    const angular = f as Extract<Fill, { kind: FillKind.Angular }>;
    return withStops(angular, (stops) => ({ type: FillType.Angular, stops, angle: angular.angle, center: angular.center, opacity: f.opacity }));
  },
  [FillKind.Diamond]: (f) => withStops(f as Extract<Fill, { kind: FillKind.Diamond }>, (stops) => ({ type: FillType.Diamond, stops, opacity: f.opacity }))
};

const fillStack = (fills: Fill[]): Painted[] => fills.flatMap((f) => MOTION_FILL[f.kind](f) ?? []);

function imageSlots(fills: Fill[]): { hash: string; at: number }[] {
  const painted = fills.filter((f) => MOTION_FILL[f.kind](f));
  return painted.flatMap((f, at) => (f.kind === FillKind.Image ? [{ hash: f.hash, at }] : []));
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
  return { doc: registered.doc, font: family };
}

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
  const drawn = drawClip(next, DrawTool.Text, { x: x0 + width / 2, y: y0 + height / 2, width, height }, p.frame, id, TextSizing.AutoWidth, { text: layer.text });
  const size = (n: number) => clamp(round((n * p.scale) / minSide(next)), TYPE_SIZE.min, TYPE_SIZE.max);
  const font = known.get(layer.font);
  const runs = layer.runs.map(({ font: f, size: s, ...rest }) => ({ ...rest, ...(f && known.get(f) ? { font: f } : {}), ...(s ? { size: size(s) } : {}) }));
  const stacked = layer.fills.length > 1 || layer.fills.some((f) => f.kind !== FillKind.Solid);
  const made = finished(drawn, id, layer, p, {
    text: layer.text,
    color: layer.color,
    ...(stacked ? { fills: fillStack(layer.fills) } : {}),
    ...(layer.strokes.length ? { strokes: strokeStack(layer.strokes, next, p) } : {}),
    ...(font ? { font } : {}),
    weight: layer.weight,
    italic: layer.italic,
    size: size(layer.size),
    letterSpacing: layer.letterSpacing,
    lineHeight: layer.lineHeight,
    align: layer.align,
    verticalAlign: 'top',
    ...(runs.length ? { runs } : {})
  });
  if (!made.ok) {
    p.report(`${layer.name}: ${made.error}`);
    return { doc, ids: [], roots: [] };
  }
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
  [LayerKind.Frame]: (doc, layer, p) => nestedFrame(doc, layer as FrameLayer, p)
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
    ...(child.kind === LayerKind.Text ? { width: Sizing.Hug, height: Sizing.Hug } : {}),
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
  return { ...built, doc: applied(built.doc, [...own, ...children, ...clipped], p, `auto layout of ${layer.name}`), roots: [container] };
}

function layersOf(doc: MotionDoc, layer: FrameLayer, p: Place): Built {
  const flow = layer.autoLayout;
  const background = frameBackground(doc, layer, p, flow ? Background.Always : Background.IfPainted);
  let built: Built = { ...background, roots: flow ? [] : background.roots };
  for (const child of layer.children) {
    const next = BUILD[child.kind](built.doc, child, p);
    built = { doc: next.doc, ids: [...built.ids, ...next.ids], roots: [...built.roots, ...next.roots] };
  }
  const [container] = background.roots;
  return flow && container ? laidOut({ ...built, roots: [container, ...built.roots] }, container, layer, flow, p) : built;
}

function grouped(built: Built, layer: FrameLayer, p: Place): Built {
  if (built.ids.length < 2) {
    return built;
  }
  const groupId = p.newId();
  let n = 0;
  const made = groupClips(built.doc, built.ids, () => (n++ === 0 ? p.newId() : groupId));
  if (!made.ok) {
    return built;
  }
  const named = editClip(made.doc, groupId, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME), ...(layer.clip === Clip.Content ? { clipContent: true } : {}) }));
  return { doc: named.ok ? named.doc : made.doc, ids: [groupId], roots: [{ id: groupId, layer }] };
}

function mainFrom(built: Built, layer: FrameLayer, component: ComponentRef, p: Place): Built {
  const ids = { comp: p.newId(), clip: p.newId() };
  let n = 0;
  const made = createComponent(built.doc, built.ids, () => (n++ === 0 ? ids.comp : ids.clip), component.name);
  if (!made.ok) {
    return grouped(built, layer, p);
  }
  p.mains.set(component.key, { compId: ids.comp, at: { x: layer.box.x, y: layer.box.y } });
  const named = editClip(made.doc, ids.clip, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME) }));
  return { doc: named.ok ? named.doc : made.doc, ids: [ids.clip], roots: [{ id: ids.clip, layer }] };
}

function instanceOfMain(doc: MotionDoc, layer: FrameLayer, main: Main, p: Place): Built {
  const id = p.newId();
  const comp = doc.comps[main.compId];
  const added = addClip(doc, { component: 'Precomp', from: 0, durationInFrames: Math.min(comp.durationInFrames, doc.durationInFrames), props: { comp: main.compId } }, id);
  const moved = added.ok ? setTransform(added.doc, id, { x: ((layer.box.x - main.at.x) * p.scale) / doc.width, y: ((layer.box.y - main.at.y) * p.scale) / doc.height }) : added;
  const named = moved.ok ? editClip(moved.doc, id, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME) })) : moved;
  if (!named.ok) {
    p.report(`${layer.name}: ${named.error}`);
    return { doc, ids: [], roots: [] };
  }
  return { doc: named.doc, ids: [id], roots: [{ id, layer }] };
}

function nestedFrame(doc: MotionDoc, layer: FrameLayer, p: Place): Built {
  const main = layer.component?.inPaste ? p.mains.get(layer.component.key) : undefined;
  if (main) {
    return instanceOfMain(doc, layer, main, p);
  }
  const built = layersOf(doc, layer, p);
  if (layer.component?.inPaste) {
    return mainFrom(built, layer, layer.component, p);
  }
  return layer.autoLayout ? built : grouped(built, layer, p);
}

function sceneOf(html: string) {
  const message = figmaMessage(html);
  const scene = message ? figmaScene(message) : null;
  return scene && message ? { scene, fileKey: message.meta.fileKey ?? null } : null;
}

const wholeSize = (size: Size): Size => ({ width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) });

function frameItem(layer: FrameLayer, centre: Unit, newId: NewId, skipped: Set<string>): PlanItem {
  const size = wholeSize(layer.box);
  const blank = drawnFrame({ left: 0, top: 0, ...size }, MotionFormat.Custom, 0);
  const images: FigmaImage[] = [];
  const place: Place = { centre: CENTRE, scale: blank.width / layer.box.width, frame: 0, newId, report: (w) => skipped.add(w), rootSize: layer.box, images, mains: new Map() };
  const built = layersOf(blank, layer, place);
  return { destination: Destination.Frame, doc: built.doc, size, centre, name: layer.name, kind: FrameKind.Frame, images };
}

function freeItem(layer: Layer, size: Size, centre: Unit, newId: NewId, skipped: Set<string>): PlanItem | null {
  const fit = wholeSize(size);
  const blank = blankElement({ left: 0, top: 0, ...fit });
  if (!blank.ok) {
    skipped.add(`${layer.name}: ${blank.error}`);
    return null;
  }
  const images: FigmaImage[] = [];
  const place: Place = { centre: CENTRE, scale: blank.doc.width / size.width, frame: 0, newId, report: (w) => skipped.add(w), rootSize: size, images, mains: new Map() };
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

export function planOf(message: FigmaMessage, newId: NewId): FigmaPlan | null {
  const scene = figmaScene(message);
  if (!scene) {
    return null;
  }
  const skipped = new Set(scene.skipped);
  const items = scene.placements.flatMap((pl) => {
    const made = isStage(pl.layer, pl.destination) ? frameItem(pl.layer, pl.centre, newId, skipped) : freeItem(pl.layer, pl.size, pl.centre, newId, skipped);
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
  const place: Place = { centre: at, scale, frame, newId, report: (w) => skipped.add(w), rootSize: scene.combined.box, images, mains: new Map() };
  const built = grouped(layersOf(doc, scene.combined, place), scene.combined, place);
  return built.ids.length ? { doc: built.doc, selection: built.ids, skipped: [...skipped], images, fileKey } : null;
}
