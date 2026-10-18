import type { MotionClip, MotionDoc, MotionTrack } from '../doc';
import type { Box } from '../layout';
import { pivotBox, type Size } from '../parent';
import { Sizing, layoutTree, type Item } from './auto-layout';
import { DEFAULT_LAYOUT_ITEM, type AutoLayout } from './model';
import { isText, textExtent } from './text-extent';

type Clips = Map<string, MotionClip>;

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

function intrinsic(clip: MotionClip, size: Size): Size {
  const box = pivotBox(clip.props, size);
  const item = clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  if (!isText(clip.component) || (item.width !== Sizing.Hug && item.height !== Sizing.Hug)) {
    return box;
  }
  const extent = textExtent(clip.component, clip.props, Math.min(size.width, size.height), item.width === Sizing.Hug ? undefined : box.width);
  return { width: item.width === Sizing.Hug ? extent.width : box.width, height: item.height === Sizing.Hug ? extent.height : box.height };
}

function itemOf(clip: MotionClip, clips: readonly MotionClip[], size: Size): Item {
  const own = clip.layoutItem ?? DEFAULT_LAYOUT_ITEM;
  const base: Item = {
    id: clip.id,
    ...intrinsic(clip, size),
    sizing: { width: own.width, height: own.height },
    min: { width: own.minWidth, height: own.minHeight },
    max: { width: own.maxWidth, height: own.maxHeight },
    absolute: own.absolute
  };
  if (!isContainer(clip)) {
    return base;
  }
  const { order: _order, ...flow } = clip.autoLayout;
  return { ...base, flow, children: childrenInOrder(clips, clip).map((c) => itemOf(c, clips, size)) };
}

function isRoot(clip: MotionClip, byId: Clips): boolean {
  return isContainer(clip) && (!isContainer(byId.get(clip.parent ?? '')) || !!clip.layoutItem?.absolute);
}

const ONE_LINE_WHEN_HUGGED: Partial<Record<MotionClip['component'], Record<string, unknown>>> = { Text: { sizing: 'auto' } };

const huggedText = (clip: MotionClip) => ((clip.layoutItem ?? DEFAULT_LAYOUT_ITEM).width === Sizing.Hug ? (ONE_LINE_WHEN_HUGGED[clip.component] ?? {}) : {});

const placedProps = (box: Box, size: Size) => ({
  x: (box.left + box.width / 2) / size.width,
  y: (box.top + box.height / 2) / size.height,
  width: box.width / size.width,
  height: box.height / size.height
});

function laidOut(tracks: MotionTrack[], size: Size): MotionTrack[] {
  const clips = visualClips(tracks);
  const byId: Clips = new Map(clips.map((c) => [c.id, c]));
  const roots = clips.filter((c) => isRoot(c, byId));
  if (!roots.length) {
    return tracks;
  }

  const boxes = new Map<string, Box>();
  for (const root of roots) {
    const { left, top } = pivotBox(root.props, size);
    layoutTree(itemOf(root, clips, size), { left, top }).forEach((box, id) => boxes.set(id, box));
  }
  const place = (clip: MotionClip): MotionClip => {
    const box = boxes.get(clip.id);
    return box ? { ...clip, props: { ...clip.props, ...huggedText(clip), ...placedProps(box, size) } } : clip;
  };
  return tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(place) }));
}

export function withAutoLayout(doc: MotionDoc): MotionDoc {
  const all = [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)];
  if (!all.some((tracks) => visualClips(tracks).some(isContainer))) {
    return doc;
  }
  const size = { width: doc.width, height: doc.height };
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: laidOut(comp.tracks, comp.frame ?? size) }]));
  return { ...doc, tracks: laidOut(doc.tracks, size), comps };
}
