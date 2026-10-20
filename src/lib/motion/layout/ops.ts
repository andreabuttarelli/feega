import { TrackKind } from '../components';
import { findClip, type MotionClip, type MotionDoc } from '../doc';
import { pivotBox } from '../parent';
import { setParent } from '../parent-ops';
import { layerOrder } from '../siblings';
import { addClip, moveClip, type OpResult } from '../timeline';
import { Align, Direction, Sizing } from './auto-layout';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM, autoLayoutSchema, layoutItemSchema, type AutoLayout, type LayoutItem } from './model';
import { childrenInOrder, withAutoLayout } from './resolve';
import { isText } from './text-extent';

const fail = (error: string): OpResult => ({ ok: false, error });

const HUG: Partial<LayoutItem> = { width: Sizing.Hug, height: Sizing.Hug };
const PX = 100;
const roundPx = (n: number) => Math.round(n * PX) / PX;

function withClip(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip): MotionDoc {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? edit(c as MotionClip) : c)) })) };
}

export const hasBox = (clip: MotionClip) => typeof clip.props.width === 'number' && typeof clip.props.height === 'number';

export function layoutParent(doc: MotionDoc, clip: MotionClip): (MotionClip & { autoLayout: AutoLayout }) | null {
  const parent = clip.parent ? findClip(doc, clip.parent)?.clip : undefined;
  return parent?.autoLayout ? (parent as MotionClip & { autoLayout: AutoLayout }) : null;
}

export function setAutoLayout(doc: MotionDoc, clipId: string, patch: Partial<AutoLayout> | null): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  if (!hasBox(found.clip)) {
    return fail(`${clipId} has no box: auto layout needs a clip with x, y, width and height (a rectangle Shape)`);
  }
  if (patch === null) {
    return { ok: true, doc: withClip(doc, clipId, (c) => ({ ...c, autoLayout: null })) };
  }
  const parsed = autoLayoutSchema.safeParse({ ...(found.clip.autoLayout ?? DEFAULT_AUTO_LAYOUT), ...patch });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return { ok: true, doc: withClip(doc, clipId, (c) => ({ ...c, autoLayout: parsed.data })) };
}

export function setLayoutItem(doc: MotionDoc, clipId: string, patch: Partial<LayoutItem>): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const parsed = layoutItemSchema.safeParse({ ...(found.clip.layoutItem ?? DEFAULT_LAYOUT_ITEM), ...patch });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return { ok: true, doc: withClip(doc, clipId, (c) => ({ ...c, layoutItem: parsed.data })) };
}

export function reorderChild(doc: MotionDoc, containerId: string, childId: string, index: number): OpResult {
  const container = findClip(doc, containerId)?.clip;
  if (!container?.autoLayout) {
    return fail(`${containerId} is not an auto layout`);
  }
  const ids = childrenInOrder(doc.tracks.flatMap((t) => t.clips as MotionClip[]), container as MotionClip & { autoLayout: AutoLayout }).map((c) => c.id);
  if (!ids.includes(childId)) {
    return fail(`${childId} is not a child of ${containerId}`);
  }
  const rest = ids.filter((id) => id !== childId);
  const at = Math.min(Math.max(0, index), rest.length);
  return setAutoLayout(doc, containerId, { order: [...rest.slice(0, at), childId, ...rest.slice(at)] });
}

export function leaveAutoLayout(doc: MotionDoc, clipId: string): OpResult {
  const found = findClip(doc, clipId);
  const container = found ? layoutParent(doc, found.clip) : null;
  if (!found || !container) {
    return fail(`${clipId} is not inside an auto layout`);
  }
  const laid = findClip(withAutoLayout(doc), clipId)!.clip.props;
  const box = { x: laid.x, y: laid.y, width: laid.width, height: laid.height };
  const unparented = setParent(doc, clipId, null);
  if (!unparented.ok) {
    return unparented;
  }
  const order = container.autoLayout.order.filter((id) => id !== clipId);
  const placed = withClip(unparented.doc, clipId, ({ layoutItem: _item, ...c }) => ({ ...c, props: { ...c.props, ...box } }));
  return setAutoLayout(placed, container.id, { order });
}

type Placed = { clip: MotionClip; trackIndex: number; box: { left: number; top: number; width: number; height: number } };

function guessFlow(placed: Placed[]): Pick<AutoLayout, 'direction' | 'gap' | 'order'> {
  const centre = (p: Placed, axis: 'left' | 'top') => p.box[axis] + (axis === 'left' ? p.box.width : p.box.height) / 2;
  const spread = (axis: 'left' | 'top') => Math.max(...placed.map((p) => centre(p, axis))) - Math.min(...placed.map((p) => centre(p, axis)));
  const direction = spread('left') >= spread('top') ? Direction.Horizontal : Direction.Vertical;
  const [start, length] = direction === Direction.Horizontal ? (['left', 'width'] as const) : (['top', 'height'] as const);
  const sorted = [...placed].sort((a, b) => a.box[start] - b.box[start]);
  const spaces = sorted.slice(1).map((p, i) => p.box[start] - (sorted[i].box[start] + sorted[i].box[length]));
  const gap = spaces.length ? Math.max(0, spaces.reduce((a, b) => a + b, 0) / spaces.length) : 0;
  return { direction, gap: roundPx(gap), order: sorted.map((p) => p.clip.id) };
}

function ownTracks(doc: MotionDoc, clipIds: readonly string[], trackId: string): MotionDoc {
  const topFirst = layerOrder(doc).filter((id) => clipIds.includes(id));
  return topFirst.reduce((next, clipId) => {
    const found = findClip(next, clipId);
    if (!found || found.track.clips.length === 1) {
      return next;
    }
    const own = { id: `${trackId}-${clipId}`, kind: found.track.kind, name: found.track.name, clips: [] };
    const at = next.tracks.indexOf(found.track);
    const moved = moveClip({ ...next, tracks: [...next.tracks.slice(0, at), own, ...next.tracks.slice(at)] }, clipId, { from: found.clip.from, trackId: own.id });
    return moved.ok ? moved.doc : next;
  }, doc);
}

enum Container {
  Frame = 'frame',
  AutoLayout = 'auto-layout'
}

const CONTAINER_TRACK: Record<Container, string> = { [Container.Frame]: 'Frame', [Container.AutoLayout]: 'Auto layout' };

export const wrapInAutoLayout = (source: MotionDoc, clipIds: readonly string[], id: string, trackId: string): OpResult => wrapped(source, clipIds, id, trackId, Container.AutoLayout);

export const wrapInFrame = (source: MotionDoc, clipIds: readonly string[], id: string, trackId: string): OpResult => wrapped(source, clipIds, id, trackId, Container.Frame);

export function removeAutoLayout(doc: MotionDoc, containerId: string): OpResult {
  const container = findClip(doc, containerId)?.clip;
  if (!container?.autoLayout) {
    return fail(`${containerId} is not an auto layout`);
  }
  const laid = withAutoLayout(doc);
  const children = doc.tracks.flatMap((t) => t.clips).filter((c) => c.parent === containerId);
  const baked = children.reduce(
    (next, child) => {
      const props = findClip(laid, child.id)!.clip.props;
      return withClip(next, child.id, ({ layoutItem: _item, ...c }) => ({ ...c, props: { ...c.props, x: props.x, y: props.y, width: props.width, height: props.height } }));
    },
    doc
  );
  return setAutoLayout(baked, containerId, null);
}

function wrapped(source: MotionDoc, clipIds: readonly string[], id: string, trackId: string, container: Container): OpResult {
  const doc = ownTracks(source, clipIds, trackId);
  const size = { width: doc.width, height: doc.height };
  const placed: Placed[] = clipIds
    .map((c) => findClip(doc, c))
    .filter((f) => f !== null && f.track.kind === TrackKind.Visual && hasBox(f.clip))
    .map((f) => ({ clip: f!.clip, trackIndex: doc.tracks.indexOf(f!.track), box: pivotBox(f!.clip.props, size) }));
  if (!placed.length) {
    return fail('select the visual clips with a box that the auto layout should hold');
  }

  const left = Math.min(...placed.map((p) => p.box.left));
  const top = Math.min(...placed.map((p) => p.box.top));
  const right = Math.max(...placed.map((p) => p.box.left + p.box.width));
  const bottom = Math.max(...placed.map((p) => p.box.top + p.box.height));
  const from = Math.min(...placed.map((p) => p.clip.from));
  const end = Math.max(...placed.map((p) => p.clip.from + p.clip.durationInFrames));
  const lane = Math.max(...placed.map((p) => p.trackIndex)) + 1;
  const tracks = [...doc.tracks.slice(0, lane), { id: trackId, kind: TrackKind.Visual, name: CONTAINER_TRACK[container], clips: [] }, ...doc.tracks.slice(lane)];

  const props = { shape: 'rect', fill: 'transparent', x: (left + right) / 2 / size.width, y: (top + bottom) / 2 / size.height, width: (right - left) / size.width, height: (bottom - top) / size.height };
  let result = addClip({ ...doc, tracks }, { component: 'Shape', from, durationInFrames: end - from, trackId, props }, id);
  if (!result.ok) {
    return result;
  }
  result = container === Container.AutoLayout ? setAutoLayout(result.doc, id, { ...guessFlow(placed), align: Align.Start }) : result;
  for (const p of placed) {
    if (!result.ok) {
      return result;
    }
    result = setParent(result.doc, p.clip.id, id, { at: p.clip.from });
    if (result.ok && container === Container.AutoLayout && isText(p.clip.component) && !p.clip.layoutItem) {
      result = setLayoutItem(result.doc, p.clip.id, HUG);
    }
  }
  return result.ok && container === Container.AutoLayout ? setLayoutItem(result.doc, id, HUG) : result;
}

export function addAutoLayout(doc: MotionDoc, clipIds: readonly string[], newId: () => string): { result: OpResult; containerId: string } {
  const [lone] = clipIds;
  if (clipIds.length === 1 && doc.tracks.some((t) => t.clips.some((c) => c.parent === lone))) {
    return { result: setAutoLayout(doc, lone, {}), containerId: lone };
  }
  const containerId = newId();
  return { result: wrapInAutoLayout(doc, clipIds, containerId, newId()), containerId };
}
