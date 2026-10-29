import type { MotionClip, MotionComp, MotionDoc, MotionTrack } from '../doc';
import type { Box } from '../layout';
import { pivotBox, type Size } from '../parent';
import { overridden } from '../instance-overrides';
import type { ShapeKind } from '../shape/schema';
import { StrokeAlign, sidesShown, strokesOf } from '../stroke/model';
import { Sizing, layoutTree, type Item, type Padding } from './auto-layout';
import { DEFAULT_LAYOUT_ITEM, type AutoLayout } from './model';
import { estimatedText, isText, textBaseline, type TextMeasure } from './text-extent';

type Clips = Map<string, MotionClip>;

type Content = (clip: MotionClip) => Box | null;

const NO_CONTENT: Content = () => null;

function boundsOf(boxes: readonly Box[]): Box | null {
  if (!boxes.length) {
    return null;
  }
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

const shifted = (box: Box, clip: MotionClip, space: Size): Box => ({ ...box, left: box.left + Number(clip.transform?.x ?? 0) * space.width, top: box.top + Number(clip.transform?.y ?? 0) * space.height });

export function compBounds(comp: MotionDoc['comps'][string], space: Size, content: Content = NO_CONTENT): Box | null {
  const boxOf = (c: MotionClip) => {
    const shown = content(c);
    return shown ? shifted(shown, c, space) : pivotBox(c.props, space);
  };
  return boundsOf(visualClips(comp.tracks).filter((c) => !c.parent && !c.hidden).map(boxOf));
}

function instanceContent(doc: MotionDoc, size: Size, measure: TextMeasure): Content {
  const cache = new Map<string, Box | null>();
  const content: Content = (clip) => {
    const id = clip.component === 'Precomp' && !clip.props.scene ? String(clip.props.comp ?? '') : '';
    const comp = id ? doc.comps[id] : undefined;
    if (!comp) {
      return null;
    }
    const space = comp.frame ?? size;
    const own = { overrides: clip.props.overrides, values: clip.props.propValues };
    const key = own.overrides || own.values ? `${id}${JSON.stringify(own)}` : id;
    if (!cache.has(key)) {
      const tracks = key === id ? comp.tracks : laidOut(overridden(comp.tracks, clip, comp.component), space, measure, instanceContent(doc, space, measure));
      cache.set(key, null);
      cache.set(key, compBounds({ ...comp, tracks }, space, content));
    }
    return cache.get(key) ?? null;
  };
  return content;
}

const visualClips = (tracks: readonly MotionTrack[]): MotionClip[] => tracks.flatMap((t) => t.clips as MotionClip[]);

const isContainer = (clip: MotionClip | undefined): clip is MotionClip & { autoLayout: AutoLayout } => !!clip?.autoLayout;

export function childrenInOrder(clips: readonly MotionClip[], container: MotionClip & { autoLayout: AutoLayout }): MotionClip[] {
  const kids = clips.filter((c) => c.parent === container.id);
  const rank = (c: MotionClip) => {
    const at = container.autoLayout.order.indexOf(c.id);
    return at < 0 ? container.autoLayout.order.length + kids.indexOf(c) : at;
  };
  return [...kids].sort((a, b) => rank(a) - rank(b));
}

function intrinsic(clip: MotionClip, size: Size, content: Content, measure: TextMeasure): Size {
  const box = content(clip) ?? pivotBox(clip.props, size);
  const item = clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  if (!isText(clip.component) || (item.width !== Sizing.Hug && item.height !== Sizing.Hug)) {
    return box;
  }
  const extent = measure(clip.component, clip.props, Math.min(size.width, size.height), item.width === Sizing.Hug ? undefined : box.width);
  return { width: item.width === Sizing.Hug ? extent.width : box.width, height: item.height === Sizing.Hug ? extent.height : box.height };
}

function reflowsText(clip: MotionClip): boolean {
  const item = clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  return isText(clip.component) && item.height === Sizing.Hug;
}

const NO_INSET: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

const widest = (a: Padding, b: Padding): Padding => ({ top: Math.max(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom), left: Math.max(a.left, b.left) });

function strokeInset(clip: MotionClip, size: Size): Padding {
  const unit = Math.min(size.width, size.height);
  const sided = sidesShown(clip.props.shape as ShapeKind);
  return strokesOf(clip.props)
    .filter((s) => s.visible && s.align === StrokeAlign.Inside)
    .map((s) => {
      const [top, right, bottom, left] = s.sides && sided ? s.sides : [s.width, s.width, s.width, s.width];
      return { top: top * unit, right: right * unit, bottom: bottom * unit, left: left * unit };
    })
    .reduce(widest, NO_INSET);
}

const withInset = (padding: Padding, inset: Padding): Padding => ({ top: padding.top + inset.top, right: padding.right + inset.right, bottom: padding.bottom + inset.bottom, left: padding.left + inset.left });

function itemOf(clip: MotionClip, clips: readonly MotionClip[], size: Size, content: Content, measure: TextMeasure): Item {
  const own = clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  const base: Item = {
    id: clip.id,
    ...intrinsic(clip, size, content, measure),
    sizing: { width: own.width, height: own.height },
    min: { width: own.minWidth, height: own.minHeight },
    max: { width: own.maxWidth, height: own.maxHeight },
    absolute: own.absolute,
    baseline: isText(clip.component) ? textBaseline(clip.component, clip.props, Math.min(size.width, size.height)) : undefined,
    heightAt: reflowsText(clip) ? (width) => measure(clip.component, clip.props, Math.min(size.width, size.height), width).height : undefined,
    cell: { column: own.column, row: own.row, columnSpan: own.columnSpan, rowSpan: own.rowSpan, x: own.cellX, y: own.cellY }
  };
  if (!isContainer(clip)) {
    return base;
  }
  const { order: _order, firstOnTop: _firstOnTop, strokesIncluded, ...rest } = clip.autoLayout;
  const flow = strokesIncluded ? { ...rest, padding: withInset(rest.padding, strokeInset(clip, size)) } : rest;
  return { ...base, flow, children: childrenInOrder(clips, clip).filter((c) => !c.hidden).map((c) => itemOf(c, clips, size, content, measure)) };
}

function isRoot(clip: MotionClip, byId: Clips): boolean {
  return isContainer(clip) && (!isContainer(byId.get(clip.parent ?? '')) || !!clip.layoutItem?.absolute);
}

const WRAP_TOLERANCE = 0.5;

const ONE_LINE_WHEN_HUGGED: Partial<Record<MotionClip['component'], Record<string, unknown>>> = { Text: { sizing: 'auto' } };

const huggedText = (clip: MotionClip, box: Box, natural: number) => ((clip.layoutItem ?? DEFAULT_LAYOUT_ITEM).width === Sizing.Hug && box.width >= natural - WRAP_TOLERANCE ? (ONE_LINE_WHEN_HUGGED[clip.component] ?? {}) : {});

const placedProps = (box: Box, size: Size) => ({
  x: (box.left + box.width / 2) / size.width,
  y: (box.top + box.height / 2) / size.height,
  width: box.width / size.width,
  height: box.height / size.height
});

function boxesOf(clips: readonly MotionClip[], size: Size, content: Content, measure: TextMeasure): Map<string, Box> {
  const byId: Clips = new Map(clips.map((c) => [c.id, c]));
  const boxes = new Map<string, Box>();
  for (const root of clips.filter((c) => isRoot(c, byId))) {
    const { left, top } = pivotBox(root.props, size);
    layoutTree(itemOf(root, clips, size, content, measure), { left, top }).forEach((box, id) => boxes.set(id, box));
  }
  return boxes;
}

function laidOut(tracks: MotionTrack[], size: Size, measure: TextMeasure, content: Content = NO_CONTENT): MotionTrack[] {
  const clips = visualClips(tracks);
  const boxes = boxesOf(clips, size, content, measure);
  if (!boxes.size) {
    return tracks;
  }

  const place = (clip: MotionClip): MotionClip => {
    const box = boxes.get(clip.id);
    if (!box) {
      return clip;
    }
    const shown = content(clip);
    if (shown) {
      return { ...clip, transform: { ...clip.transform, x: (box.left - shown.left) / size.width, y: (box.top - shown.top) / size.height } };
    }
    return { ...clip, props: { ...clip.props, ...huggedText(clip, box, intrinsic(clip, size, content, measure).width), ...placedProps(box, size) } };
  };
  return tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(place) }));
}

const laidComps = (doc: MotionDoc, size: Size, measure: TextMeasure): MotionDoc['comps'] => Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: laidOut(comp.tracks, comp.frame ?? size, measure, instanceContent(doc, comp.frame ?? size, measure)) }]));

export function withAutoLayout(doc: MotionDoc, measure: TextMeasure = estimatedText): MotionDoc {
  const all = [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)];
  if (!all.some((tracks) => visualClips(tracks).some(isContainer))) {
    return doc;
  }
  const size = { width: doc.width, height: doc.height };
  const comps = laidComps(doc, size, measure);
  return { ...doc, tracks: laidOut(doc.tracks, size, measure, instanceContent({ ...doc, comps }, size, measure)), comps };
}

const RESIZE_TOLERANCE = 0.5;
const WIDTH_VARIANT = '@w';

function widened(comp: MotionComp, width: number, space: Size): MotionComp | null {
  const tops = visualClips(comp.tracks).filter((c) => !c.parent && !c.hidden);
  const root = tops.length === 1 && isContainer(tops[0]) ? tops[0] : null;
  if (!root) {
    return null;
  }
  const item = { ...(root.layoutItem ?? DEFAULT_LAYOUT_ITEM), width: Sizing.Fixed };
  const resized = (c: MotionClip): MotionClip => (c.id === root.id ? { ...c, layoutItem: item, props: { ...c.props, width: width / space.width } } : c);
  return { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(resized) })) as MotionTrack[] };
}

export function withFittedInstances(doc: MotionDoc): MotionDoc {
  const size = { width: doc.width, height: doc.height };
  const content = instanceContent({ ...doc, comps: laidComps(doc, size, estimatedText) }, size, estimatedText);
  const boxes = boxesOf(visualClips(doc.tracks), size, content, estimatedText);
  const variants: MotionDoc['comps'] = {};

  const fitted = (clip: MotionClip): MotionClip => {
    const box = boxes.get(clip.id);
    const shown = content(clip);
    if (!box || !shown || Math.abs(box.width - shown.width) < RESIZE_TOLERANCE) {
      return clip;
    }
    const source = String(clip.props.comp);
    const id = `${source}${WIDTH_VARIANT}${Math.round(box.width)}`;
    const variant = variants[id] ?? widened(doc.comps[source], box.width, doc.comps[source].frame ?? size);
    if (!variant) {
      return clip;
    }
    variants[id] = variant;
    return { ...clip, props: { ...clip.props, comp: id } };
  };

  const tracks = doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(fitted) })) as MotionTrack[];
  return Object.keys(variants).length ? { ...doc, tracks, comps: { ...doc.comps, ...variants } } : doc;
}

function contentBottom(doc: MotionDoc): number {
  const size = { width: doc.width, height: doc.height };
  const roots = visualClips(withAutoLayout(doc).tracks).filter((c) => !c.parent && isContainer(c) && !c.hidden && (c.layoutItem ?? DEFAULT_LAYOUT_ITEM).height === Sizing.Hug);
  const box = boundsOf(roots.map((c) => pivotBox(c.props, size)));
  return box ? box.top + box.height : 0;
}

const VERTICAL_PROPS = ['y', 'height'] as const;

function stretchedClip(clip: MotionClip, along: number, unit: number): MotionClip {
  const props = { ...clip.props };
  for (const key of VERTICAL_PROPS) {
    if (typeof props[key] === 'number') {
      props[key] = (props[key] as number) * along;
    }
  }
  if (typeof props.size === 'number') {
    props.size = props.size * unit;
  }
  return { ...clip, props };
}

const stretchedTracks = (tracks: MotionTrack[], along: number, unit: number): MotionTrack[] => tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => stretchedClip(c, along, unit)) })) as MotionTrack[];

export function restretched(doc: MotionDoc, height: number): MotionDoc {
  const along = doc.height / height;
  const unit = Math.min(doc.width, doc.height) / Math.min(doc.width, height);
  const comps = Object.fromEntries(Object.entries(doc.comps ?? {}).map(([id, comp]) => [id, comp.frame ? comp : { ...comp, tracks: stretchedTracks(comp.tracks, along, unit) }])) as MotionDoc['comps'];
  return { ...doc, height, tracks: stretchedTracks(doc.tracks, along, unit), comps };
}

export function withContentHeight(doc: MotionDoc): MotionDoc {
  const height = Math.ceil(contentBottom(doc));
  return height <= doc.height ? doc : restretched(doc, height);
}
