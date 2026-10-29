import { TrackKind } from '@feega/motion-core/motion/components';
import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { KeepWorld, setParent } from '../parent-ops';
import { layerOrder } from '../siblings';
import { addClip, moveClip, removeClips, setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import type { SizeEntry } from '@feega/motion-core/motion/layout/size-entry';
import { Align, Direction, Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { DEFAULT_LAYOUT_ITEM, NEW_AUTO_LAYOUT, autoLayoutSchema, flexOnHug, layoutItemSchema, type AutoLayout, type LayoutItem } from '@feega/motion-core/motion/layout/model';
import { childrenInOrder, withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { isText } from '@feega/motion-core/motion/layout/text-extent';
import { Placement, placementOf } from '@feega/motion-core/motion/layout/stack';

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
  const parsed = autoLayoutSchema.safeParse({ ...(found.clip.autoLayout ?? NEW_AUTO_LAYOUT), ...patch });
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const invalid = flexOnHug(parsed.data, found.clip.layoutItem);
  if (invalid) {
    return fail(invalid);
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
  const invalid = flexOnHug(found.clip.autoLayout, parsed.data);
  if (invalid) {
    return fail(invalid);
  }
  return { ok: true, doc: withClip(doc, clipId, (c) => ({ ...c, layoutItem: parsed.data })) };
}

type Axis = 'width' | 'height';

const GROW_KEY = { width: 'widthGrow', height: 'heightGrow' } as const;
const PERCENT_KEY = { width: 'widthPercent', height: 'heightPercent' } as const;
const DOC_SIDE = { width: 'width', height: 'height' } as const;

const SIZE_PATCH: Record<Sizing, (axis: Axis, value: number | undefined) => Partial<LayoutItem>> = {
  [Sizing.Fixed]: (axis) => ({ [axis]: Sizing.Fixed }),
  [Sizing.Hug]: (axis) => ({ [axis]: Sizing.Hug }),
  [Sizing.Fill]: (axis, value) => ({ [axis]: Sizing.Fill, [GROW_KEY[axis]]: value ?? 1 }),
  [Sizing.Percent]: (axis, value) => ({ [axis]: Sizing.Percent, [PERCENT_KEY[axis]]: value })
};

export function setChildSize(doc: MotionDoc, clipId: string, axis: Axis, entry: SizeEntry): OpResult {
  const sized = setLayoutItem(doc, clipId, SIZE_PATCH[entry.sizing](axis, entry.value));
  if (!sized.ok || entry.sizing !== Sizing.Fixed || entry.value === undefined) {
    return sized;
  }
  return setProps(sized.doc, clipId, { [axis]: entry.value / doc[DOC_SIDE[axis]] });
}

const ALONG: Record<Direction, (by: readonly [number, number]) => number> = {
  [Direction.Horizontal]: ([dx]) => Math.sign(dx),
  [Direction.Vertical]: ([, dy]) => Math.sign(dy),
  [Direction.Grid]: ([dx, dy]) => Math.sign(dx || dy)
};

export function stackPlaced(doc: MotionDoc, clipId: string): boolean {
  const child = findClip(doc, clipId)?.clip as MotionClip | undefined;
  return !!child && placementOf(child, layoutParent(doc, child)) === Placement.Flow;
}

const PLACED_BY_STACK: ReadonlySet<string> = new Set(['x', 'y']);

export function stackPositionProblem(doc: MotionDoc, clipId: string, keys: readonly string[]): string | null {
  if (!stackPlaced(doc, clipId) || !keys.some((k) => PLACED_BY_STACK.has(k))) {
    return null;
  }
  return `${clipId} is placed by its stack: reorder it with reorder_stack, or set_layout_item absolute true to position it by x/y relative to the stack`;
}

export function arrowStep(doc: MotionDoc, clipId: string, by: readonly [number, number]): number {
  const child = findClip(doc, clipId)?.clip as MotionClip | undefined;
  const parent = child ? layoutParent(doc, child) : null;
  return parent ? ALONG[parent.autoLayout.direction](by) : 0;
}

export function stepInStack(doc: MotionDoc, clipId: string, step: number): OpResult {
  const child = findClip(doc, clipId)?.clip;
  const parent = child ? layoutParent(doc, child as MotionClip) : null;
  if (!parent) {
    return fail(`${clipId} is not in a stack`);
  }
  const ids = childrenInOrder(doc.tracks.flatMap((t) => t.clips as MotionClip[]), parent).map((c) => c.id);
  const at = ids.indexOf(clipId) + step;
  if (at < 0 || at >= ids.length) {
    return fail(`${clipId} is already at the ${step < 0 ? 'start' : 'end'} of the stack`);
  }
  return reorderChild(doc, parent.id, clipId, at);
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

export function leaveStack(doc: MotionDoc, clipId: string): OpResult {
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
  Stack = 'stack',
  Group = 'group'
}

const CONTAINER_TRACK: Record<Container, string> = { [Container.Frame]: 'Frame', [Container.Stack]: 'Stack', [Container.Group]: 'Group' };

export const wrapInStack = (source: MotionDoc, clipIds: readonly string[], id: string, trackId: string): OpResult => wrapped(source, clipIds, id, trackId, Container.Stack);

export const wrapInGroup = (source: MotionDoc, clipIds: readonly string[], id: string, trackId: string): OpResult => wrapped(source, clipIds, id, trackId, Container.Group);

export const wrapInFrame = (source: MotionDoc, clipIds: readonly string[], id: string, trackId: string): OpResult => wrapped(source, clipIds, id, trackId, Container.Frame);

export function resizeToFit(doc: MotionDoc, containerId: string): OpResult {
  const container = findClip(doc, containerId)?.clip;
  const children = doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.parent === containerId && hasBox(c));
  if (!container || !children.length) {
    return fail(`${containerId} has no children to fit`);
  }
  if (container.autoLayout) {
    return setLayoutItem(doc, containerId, HUG);
  }

  return { ok: true, doc: withClip(doc, containerId, (c) => ({ ...c, props: { ...c.props, ...boxAround(doc, children) } })) };
}

export function boxAround(doc: MotionDoc, children: readonly MotionClip[]) {
  const size = { width: doc.width, height: doc.height };
  const boxes = children.map((c) => pivotBox(c.props, size));
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { x: (left + right) / 2 / size.width, y: (top + bottom) / 2 / size.height, width: (right - left) / size.width, height: (bottom - top) / size.height };
}

export function freezeLayout(doc: MotionDoc, containerId: string): OpResult {
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

const allClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function sharedParent(placed: readonly Placed[]): string | null {
  const parents = new Set(placed.map((p) => p.clip.parent ?? null));
  return parents.size === 1 ? [...parents][0] : null;
}

function takePlace(doc: MotionDoc, parentId: string | null, taken: readonly string[], id: string): OpResult {
  const parent = parentId ? findClip(doc, parentId)?.clip : undefined;
  const placed = setParent(doc, id, parentId, { keep: KeepWorld.No });
  if (!placed.ok || !parent?.autoLayout) {
    return placed;
  }
  const ids = childrenInOrder(allClips(doc), parent as MotionClip & { autoLayout: AutoLayout }).map((c) => c.id);
  const at = ids.findIndex((c) => taken.includes(c));
  const order = ids.filter((c) => !taken.includes(c) && c !== id);
  order.splice(Math.max(0, at), 0, id);
  return setAutoLayout(placed.doc, parent.id, { order });
}

function wrapped(source: MotionDoc, clipIds: readonly string[], id: string, trackId: string, container: Container): OpResult {
  const doc = ownTracks(source, clipIds, trackId);
  const laid = withAutoLayout(doc);
  const size = { width: doc.width, height: doc.height };
  const placed: Placed[] = clipIds
    .map((c) => findClip(doc, c))
    .filter((f) => f !== null && f.track.kind === TrackKind.Visual && hasBox(f.clip))
    .map((f) => ({ clip: f!.clip, trackIndex: doc.tracks.indexOf(f!.track), box: pivotBox(findClip(laid, f!.clip.id)!.clip.props, size) }));
  if (!placed.length) {
    return fail('select the visual clips with a box that the stack should hold');
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
  result = result.ok ? takePlace(result.doc, sharedParent(placed), placed.map((p) => p.clip.id), id) : result;
  result = container === Container.Stack && result.ok ? setAutoLayout(result.doc, id, { ...guessFlow(placed), align: Align.Start }) : result;
  result = container === Container.Group && result.ok ? { ok: true, doc: withClip(result.doc, id, (c) => ({ ...c, group: true })) } : result;
  for (const p of placed) {
    if (!result.ok) {
      return result;
    }
    result = setParent(result.doc, p.clip.id, id, { at: p.clip.from });
    if (result.ok && container === Container.Stack && isText(p.clip.component) && !p.clip.layoutItem) {
      result = setLayoutItem(result.doc, p.clip.id, HUG);
    }
  }
  return result.ok && container === Container.Stack ? setLayoutItem(result.doc, id, HUG) : result;
}

export function wrapWithStack(doc: MotionDoc, clipIds: readonly string[], newId: () => string): { result: OpResult; containerId: string } {
  const containerId = newId();
  return { result: wrapInStack(doc, clipIds, containerId, newId()), containerId };
}

export function removeStack(doc: MotionDoc, stackId: string): OpResult {
  const found = findClip(doc, stackId);
  if (!found?.clip.autoLayout) {
    return fail(`${stackId} is not a stack`);
  }
  const kids = childrenInOrder(allClips(doc), found.clip as MotionClip & { autoLayout: AutoLayout }).map((c) => c.id);
  let result = freezeLayout(doc, stackId);
  for (const kid of kids) {
    result = result.ok ? setParent(result.doc, kid, found.clip.parent ?? null) : result;
  }
  result = result.ok ? reordered(result.doc, found.clip.parent ?? null, stackId, kids) : result;
  result = result.ok ? removeClips(result.doc, [stackId]) : result;
  return result.ok ? { ok: true, doc: { ...result.doc, tracks: result.doc.tracks.filter((t) => t.id !== found.track.id || t.clips.length > 0) } } : result;
}

function reordered(doc: MotionDoc, parentId: string | null, stackId: string, kids: readonly string[]): OpResult {
  const parent = parentId ? findClip(doc, parentId)?.clip : undefined;
  if (!parent?.autoLayout) {
    return { ok: true, doc };
  }
  const ids = childrenInOrder(allClips(doc), parent as MotionClip & { autoLayout: AutoLayout }).map((c) => c.id);
  const rest = ids.filter((id) => !kids.includes(id));
  const at = rest.indexOf(stackId);
  return setAutoLayout(doc, parent.id, { order: [...rest.slice(0, at), ...kids, ...rest.slice(at + 1)] });
}
