import type { MotionDoc } from '$lib/motion/doc';
import { drawClip, drawnFrame, penClip } from '$lib/motion/draw-create';
import { DrawTool } from '$lib/motion/draw-tool';
import { EffectKind } from '$lib/motion/effects/registry';
import type { Effect } from '$lib/motion/effects/model';
import { FillType } from '$lib/motion/fill/model';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { registerFont } from '$lib/motion/fonts/ops';
import { groupClips } from '$lib/motion/group';
import { mapOutline, parsePath, type Pt } from '$lib/motion/shape/geometry';
import type { SvgGradient } from '$lib/motion/shape/svg-import';
import { TextSizing } from '$lib/motion/text-sizing';
import { editClip, setProps, type OpResult } from '$lib/motion/timeline';
import { figmaMessage } from './archive';
import { Clip, FillKind, LayerKind, figmaScene, type Fill, type FrameLayer, type Blur, type Layer, type LayerEffect, type Shadow, type ShapeLayer, type TextLayer } from './scene';

type NewId = () => string;
type Unit = { x: number; y: number };
type Built = { doc: MotionDoc; ids: string[] };
type Place = { centre: Unit; scale: number; frame: number; newId: NewId; report: (what: string) => void; root: FrameLayer };

export type FigmaFrame = { doc: MotionDoc; box: { width: number; height: number }; name: string; skipped: string[] };
export type FigmaPasted = { doc: MotionDoc; selection: string[]; skipped: string[] };

const IMAGE_PLACEHOLDER = '#d9d9d9';
const DIGITS = 10000;
const MAX_NAME = 60;
const SHADOW_DISTANCE_LIMIT = 300;

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const minSide = (doc: MotionDoc) => Math.min(doc.width, doc.height);

const toUnit = (doc: MotionDoc, p: Place) => ([x, y]: Pt): Pt => [(p.centre.x * doc.width + (x - p.root.box.width / 2) * p.scale) / doc.width, (p.centre.y * doc.height + (y - p.root.box.height / 2) * p.scale) / doc.height];

const GRADIENT: Partial<Record<FillKind, (f: Fill) => SvgGradient>> = {
  [FillKind.Linear]: (f) => ({ type: FillType.Linear, stops: 'stops' in f ? f.stops : [], angle: 'angle' in f ? f.angle : 0 }),
  [FillKind.Radial]: (f) => ({ type: FillType.Radial, stops: 'stops' in f ? f.stops : [], center: { x: 0.5, y: 0.5 }, radius: 1 })
};

function paintOf(layer: { fills: Fill[]; strokes: ShapeLayer['strokes'] }, doc: MotionDoc, p: Place): Record<string, unknown> {
  const [fill, ...more] = layer.fills;
  if (more.length) {
    p.report('stacked fills: only the top one kept');
  }
  const gradient = fill ? GRADIENT[fill.kind]?.(fill) : undefined;
  const stroke = layer.strokes[0];
  return {
    ...(fill ? {} : { fillKind: 'none' }),
    ...(fill?.kind === FillKind.Solid ? { fillKind: 'solid', fill: fill.color } : {}),
    ...(fill?.kind === FillKind.Image ? { fillKind: 'solid', fill: IMAGE_PLACEHOLDER } : {}),
    ...(gradient ? { fills: [gradient] } : {}),
    ...(stroke ? { strokeKind: 'solid', stroke: stroke.color, strokeWidth: clamp(round((stroke.weight * p.scale) / minSide(doc)), 0, 0.2) } : {})
  };
}

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
  const styled = setProps(made.doc, id, { ...props, ...(layer.opacity < 1 ? { opacity: layer.opacity } : {}) });
  if (!styled.ok) {
    p.report(`style of ${layer.name}: ${styled.error}`);
  }
  const effects = layer.effects.map((e, i): Effect => ({ id: `fx${i + 1}`, enabled: true, ...EFFECT[e.kind](e, p) }));
  return editClip(styled.ok ? styled.doc : made.doc, id, (clip) => ({ ...clip, name: layer.name.slice(0, MAX_NAME), ...(effects.length ? { effects } : {}) }));
}

function shapeClip(doc: MotionDoc, layer: { name: string; path: string; fillRule: string; fills: Fill[]; strokes: ShapeLayer['strokes'] } & Pick<Layer, 'opacity' | 'effects'>, p: Place): Built {
  const outline = parsePath(layer.path);
  if (typeof outline === 'string') {
    p.report(`path of ${layer.name}`);
    return { doc, ids: [] };
  }
  const id = p.newId();
  const made = finished(penClip(doc, mapOutline(outline, toUnit(doc, p)), p.frame, id, {}), id, layer as Layer, p, { ...paintOf(layer, doc, p), fillRule: layer.fillRule });
  return made.ok ? { doc: made.doc, ids: [id] } : (p.report(`${layer.name}: ${made.error}`), { doc, ids: [] });
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
  const id = p.newId();
  const drawn = drawClip(next, DrawTool.Text, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, width: x1 - x0, height: y1 - y0 }, p.frame, id, TextSizing.AutoWidth, { text: layer.text });
  const size = (n: number) => round((n * p.scale) / minSide(next));
  const font = known.get(layer.font);
  const runs = layer.runs.map(({ font: f, size: s, ...rest }) => ({ ...rest, ...(f && known.get(f) ? { font: f } : {}), ...(s ? { size: size(s) } : {}) }));
  const made = finished(drawn, id, layer, p, {
    text: layer.text,
    color: layer.color,
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
  return made.ok ? { doc: made.doc, ids: [id] } : (p.report(`${layer.name}: ${made.error}`), { doc, ids: [] });
}

function frameBackground(doc: MotionDoc, layer: FrameLayer, p: Place): Built {
  if (!layer.fills.length && !layer.strokes.length) {
    return { doc, ids: [] };
  }
  const { x, y } = layer.box;
  const [w, h] = [layer.box.width, layer.box.height];
  const [tl, tr, br, bl] = layer.radii.map((r) => Math.min(r, Math.min(w, h) / 2));
  const path = `M${x + tl} ${y} L${x + w - tr} ${y} Q${x + w} ${y} ${x + w} ${y + tr} L${x + w} ${y + h - br} Q${x + w} ${y + h} ${x + w - br} ${y + h} L${x + bl} ${y + h} Q${x} ${y + h} ${x} ${y + h - bl} L${x} ${y + tl} Q${x} ${y} ${x + tl} ${y} Z`;
  return shapeClip(doc, { name: layer.name, path, fillRule: 'nonzero', fills: layer.fills, strokes: layer.strokes, opacity: 1, effects: layer.effects }, p);
}

const BUILD: Record<LayerKind, (doc: MotionDoc, layer: Layer, p: Place) => Built> = {
  [LayerKind.Shape]: (doc, layer, p) => shapeClip(doc, layer as ShapeLayer, p),
  [LayerKind.Text]: (doc, layer, p) => textClip(doc, layer as TextLayer, p),
  [LayerKind.Frame]: (doc, layer, p) => nestedFrame(doc, layer as FrameLayer, p)
};

function layersOf(doc: MotionDoc, layer: FrameLayer, p: Place): Built {
  let built = frameBackground(doc, layer, p);
  for (const child of layer.children) {
    const next = BUILD[child.kind](built.doc, child, p);
    built = { doc: next.doc, ids: [...built.ids, ...next.ids] };
  }
  return built;
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
  return { doc: named.ok ? named.doc : made.doc, ids: [groupId] };
}

function nestedFrame(doc: MotionDoc, layer: FrameLayer, p: Place): Built {
  return grouped(layersOf(doc, layer, p), layer, p);
}

function sceneOf(html: string) {
  const message = figmaMessage(html);
  return message ? figmaScene(message) : null;
}

export function figmaFrameDoc(html: string, newId: NewId): FigmaFrame | null {
  const scene = sceneOf(html);
  if (!scene) {
    return null;
  }
  const { root } = scene;
  const box = { width: Math.max(1, Math.round(root.box.width)), height: Math.max(1, Math.round(root.box.height)) };
  const blank = drawnFrame({ left: 0, top: 0, ...box });
  const skipped = new Set(scene.skipped);
  const place: Place = { centre: { x: 0.5, y: 0.5 }, scale: blank.width / root.box.width, frame: 0, newId, report: (w) => skipped.add(w), root };
  const built = layersOf(blank, root, place);
  return { doc: built.doc, box, name: root.name, skipped: [...skipped] };
}

export function figmaIntoFrame(doc: MotionDoc, html: string, at: Unit, scale: number, frame: number, newId: NewId): FigmaPasted | null {
  const scene = sceneOf(html);
  if (!scene) {
    return null;
  }
  const skipped = new Set(scene.skipped);
  const place: Place = { centre: at, scale, frame, newId, report: (w) => skipped.add(w), root: scene.root };
  const built = grouped(layersOf(doc, scene.root, place), scene.root, place);
  return built.ids.length ? { doc: built.doc, selection: built.ids, skipped: [...skipped] } : null;
}
