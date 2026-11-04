import { z } from 'zod';
import { FrameKind, drawnFrameNodeOf, elementNodeOf, frameChrome } from '$lib/canvas/motion-node';
import { rotateGroup, scaleGroup, translateGroup, type Placed } from '$lib/canvas/node-layout';
import { Background, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { TrackKind } from '@feega/motion-core/motion/components';
import type { AutoLayout } from '@feega/motion-core/motion/layout/model';
import { blankElement, drawnFrame, type CanvasBox } from '$lib/motion/draw-create';
import { clipCentre, elementBox, frameOf, liftElement, rehomedClip } from '$lib/motion/move-element';
import { docMode } from '@feega/motion-core/motion/still';
import { elementName } from '$lib/motion/element-name';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { wrapWithStack } from '$lib/motion/layout/ops';
import { freeStackFit, laidOutAsShown } from '$lib/motion/layout/stack-fit';
import { MoveOutcome, created, deleted, refused, type FrameStore, type Moved, type Place, type StoredFrame } from './move-element';

export const groupAskSchema = z.object({ ids: z.array(z.string().min(1)).min(2).max(50), id: z.string().uuid().optional() }).strict();

export const stackAskSchema = groupAskSchema.extend({ ids: z.array(z.string().min(1)).min(1).max(50) });

export const frameAskSchema = stackAskSchema;

const GROUP_NAME = 'Group';
const STACK_NAME = 'Stack';
const FRAME_NAME = 'Frame';

const newId = () => crypto.randomUUID().slice(0, 8);

type Free = StoredFrame & { box: CanvasBox };

const boxOf = (frame: StoredFrame): CanvasBox | null => (frame.at && frame.stage ? { left: frame.at.x, top: frame.at.y, width: frame.stage.width, height: frame.stage.height } : null);

function union(boxes: readonly CanvasBox[]): CanvasBox {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

const topClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips);

async function readFree(store: FrameStore, ids: readonly string[]): Promise<Free[] | null> {
  const read = await Promise.all(ids.map((id) => store.read(id)));
  const free = read.map((f) => (f && !frameChrome(f.kind ?? FrameKind.Frame).takesDrops && boxOf(f) ? { ...f, box: boxOf(f)! } : null));
  return free.every((f) => f !== null) ? (free as Free[]) : null;
}

const seenSize = (sheet: MotionDoc, from: CanvasBox, to: CanvasBox) => ({ width: (sheet.width * from.width) / to.width, height: (sheet.height * from.height) / to.height });

const pxScale = (source: Free, sheet: MotionDoc, to: CanvasBox) => sheet.width / to.width / (source.doc.width / source.box.width);

function scaledLayout(layout: AutoLayout, factor: number, rename: (id: string) => string): AutoLayout {
  const { padding } = layout;
  return {
    ...layout,
    gap: layout.gap * factor,
    crossGap: layout.crossGap * factor,
    padding: { top: padding.top * factor, right: padding.right * factor, bottom: padding.bottom * factor, left: padding.left * factor },
    order: layout.order.map(rename)
  };
}

function renamer(sheet: MotionDoc, source: MotionDoc): (id: string) => string {
  const taken = new Set(topClips(sheet).map((c) => c.id));
  const names = new Map(topClips(source).map((c) => [c.id, taken.has(c.id) ? newId() : c.id]));
  return (id) => names.get(id) ?? id;
}

function carried(source: Free, sheet: MotionDoc, to: CanvasBox): MotionTrack[] {
  const rename = renamer(sheet, source.doc);
  const seen = seenSize(sheet, source.box, to);
  const stage = { width: sheet.width, height: sheet.height };
  const factor = pxScale(source, sheet, to);
  const visual = source.doc.tracks.filter((t) => t.kind === TrackKind.Visual && t.clips.length);
  return visual.map((track) => ({
    ...track,
    id: newId(),
    clips: (track.clips as MotionClip[]).map((clip) => {
      const centre = clipCentre(clip);
      const at = { x: (source.box.left + centre.x * source.box.width - to.left) / to.width, y: (source.box.top + centre.y * source.box.height - to.top) / to.height };
      const moved = rehomedClip(clip, seen, stage, at);
      return { ...moved, id: rename(clip.id), parent: clip.parent ? rename(clip.parent) : null, ...(clip.autoLayout ? { autoLayout: scaledLayout(clip.autoLayout, factor, rename) } : {}) };
    })
  }));
}

function unionOf<T>(items: readonly T[], extra: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set(items.map(key));
  return [...items, ...extra.filter((item) => !seen.has(key(item)))];
}

function placeAll(sheet: MotionDoc, sources: readonly Free[], to: CanvasBox): MotionDoc {
  return sources.reduce(
    (doc, source) => ({
      ...doc,
      tracks: [...carried(source, doc, to), ...doc.tracks],
      assets: unionOf(doc.assets, source.doc.assets, (a) => a.id),
      fonts: unionOf(doc.fonts, source.doc.fonts, (f) => f.family),
      components: { ...source.doc.components, ...doc.components },
      comps: { ...source.doc.comps, ...doc.comps }
    }),
    sheet
  );
}

const rootIds = (doc: MotionDoc) => doc.tracks.filter((t) => t.kind === TrackKind.Visual).flatMap((t) => t.clips.filter((c) => !c.parent).map((c) => c.id));

export type Member = { id: string; box: CanvasBox; rotation: number; groupId: string | null; version: number; data: Record<string, unknown> };

export type Members = {
  read: (ids: readonly string[]) => Promise<Member[]>;
  inGroup: (groupId: string) => Promise<Member[]>;
  join: (id: string, groupId: string | null) => Promise<UndoItem | null>;
  place: (id: string, at: { x: number; y: number; rotation: number }) => Promise<void>;
  resize: (id: string, at: { x: number; y: number; w: number; h: number }) => Promise<void>;
  sendBack: (id: string) => Promise<void>;
};

async function splitPicked(store: FrameStore, members: Members, ids: readonly string[]): Promise<{ free: Free[]; joined: Member[] }> {
  const read = await Promise.all(ids.map((id) => store.read(id)));
  const free = read.flatMap((f) => (f && !frameChrome(f.kind ?? FrameKind.Frame).takesDrops && boxOf(f) ? [{ ...f, box: boxOf(f)! }] : []));
  const freeIds = new Set(free.map((f) => f.nodeId));
  const joined = await members.read(ids.filter((id) => !freeIds.has(id)));
  return { free, joined };
}

export async function groupElements(store: FrameStore, members: Members, place: Place, ids: readonly string[], id?: string): Promise<Moved> {
  const { free: sources, joined } = await splitPicked(store, members, ids);
  if (sources.length + joined.length < 2) {
    return refused(MoveOutcome.Invalid, 'pick two or more things on the canvas to group');
  }
  const bounds = union([...sources.map((s) => s.box), ...joined.map((m) => m.box)]);
  const sheet = blankElement(bounds);
  if (!sheet.ok) {
    return refused(MoveOutcome.Invalid, sheet.error);
  }
  const doc = placeAll(sheet.doc, sources, bounds);

  const shaped = elementNodeOf(bounds, FrameKind.Group);
  const at = { x: bounds.left, y: bounds.top };
  const groupId = await store.create({ ...place, ...at, id }, doc, { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h, displayName: GROUP_NAME });
  await Promise.all(sources.map((s) => store.remove(s.nodeId)));
  if (joined.length) {
    await members.sendBack(groupId);
  }
  const joins = (await Promise.all(joined.map((m) => members.join(m.id, groupId)))).filter((u): u is UndoItem => u !== null);
  return { outcome: MoveOutcome.Done, frameId: groupId, clipId: '', created: true, versions: { [groupId]: 1 }, undo: [created(groupId, at), ...sources.map(deleted), ...joins] };
}

export async function stackElements(store: FrameStore, place: Place, ids: readonly string[], id?: string): Promise<Moved> {
  const sources = await readFree(store, ids);
  if (!sources || sources.some((s) => s.kind === FrameKind.Group)) {
    return refused(MoveOutcome.Invalid, 'pick free elements on the canvas to wrap with a stack');
  }
  const bounds = union(sources.map((s) => s.box));
  const sheet = blankElement(bounds);
  if (!sheet.ok) {
    return refused(MoveOutcome.Invalid, sheet.error);
  }
  const placed = placeAll(sheet.doc, sources, bounds);
  const { result } = wrapWithStack(placed, rootIds(placed), newId);
  if (!result.ok) {
    return refused(MoveOutcome.Invalid, result.error);
  }

  const fit = freeStackFit(result.doc);
  const doc = laidOutAsShown(fit?.doc ?? result.doc);
  const box = { ...bounds, width: bounds.width * (fit?.share.width ?? 1), height: bounds.height * (fit?.share.height ?? 1) };
  const shaped = elementNodeOf(box);
  const at = { x: box.left, y: box.top };
  const stackId = await store.create({ ...place, ...at, id }, doc, { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h, displayName: STACK_NAME });
  await Promise.all(sources.map((s) => store.remove(s.nodeId)));
  return { outcome: MoveOutcome.Done, frameId: stackId, clipId: '', created: true, versions: { [stackId]: 1 }, undo: [created(stackId, at), ...sources.map(deleted)] };
}

export async function frameElements(store: FrameStore, place: Place, ids: readonly string[], id?: string): Promise<Moved> {
  const sources = await readFree(store, ids);
  if (!sources) {
    return refused(MoveOutcome.Invalid, 'pick free elements on the canvas to frame; a frame goes inside another by dropping it');
  }
  const bounds = union(sources.map((s) => s.box));
  const doc = placeAll(drawnFrame(bounds), sources, bounds);

  const shaped = drawnFrameNodeOf(bounds);
  const at = { x: bounds.left, y: bounds.top };
  const frameId = await store.create({ ...place, ...at, id }, doc, { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h, displayName: FRAME_NAME });
  await Promise.all(sources.map((s) => store.remove(s.nodeId)));
  return { outcome: MoveOutcome.Done, frameId, clipId: '', created: true, versions: { [frameId]: 1 }, undo: [created(frameId, at), ...sources.map(deleted)] };
}

export async function ungroupElement(store: FrameStore, members: Members, place: Place, id: string): Promise<Moved> {
  const [group] = (await readFree(store, [id])) ?? [];
  const clips = group ? topClips(group.doc) : [];
  const joined = group ? await members.inGroup(group.nodeId) : [];
  if (!group || clips.length + joined.length < 2) {
    return refused(MoveOutcome.Invalid, 'not a group');
  }
  const released = (await Promise.all(joined.map((m) => members.join(m.id, null)))).filter((u): u is UndoItem => u !== null);

  const mode = docMode(group.doc);
  const made: { id: string; at: { x: number; y: number } }[] = [];
  for (const clip of clips) {
    const lifted = liftElement(group.doc, clip.id);
    if (!lifted.ok) {
      continue;
    }
    const area = elementBox(lifted.element);
    const box = { left: group.box.left + area.left * group.box.width, top: group.box.top + area.top * group.box.height, width: area.width * group.box.width, height: area.height * group.box.height };
    const shaped = elementNodeOf(box);
    const at = { x: box.left, y: box.top };
    const doc = { ...frameOf(lifted.element, mode, area, newId), background: Background.Transparent };
    made.push({ id: await store.create({ ...place, ...at }, doc, { type: shaped.type, data: shaped.data, width: shaped.w, height: shaped.h, displayName: elementName(clip) }), at });
  }
  await store.remove(group.nodeId);
  const first = made[0]?.id ?? '';
  return { outcome: MoveOutcome.Done, frameId: first, clipId: '', created: true, versions: Object.fromEntries(made.map((m) => [m.id, 1])), undo: [...made.map((m) => created(m.id, m.at)), deleted(group), ...released] };
}

export async function rotateNodeGroup(store: FrameStore, members: Members, id: string, degrees: number): Promise<Moved> {
  const [group] = await members.read([id]);
  if (!group || !(await store.read(id))) {
    return refused(MoveOutcome.NotFound, `nothing to turn at ${id}`);
  }
  const inside = await members.inGroup(id);
  const placed = (m: Member): Placed => ({ id: m.id, x: m.box.left, y: m.box.top, w: m.box.width, h: m.box.height, rotation: m.rotation });
  const turned = rotateGroup(placed(group), inside.map(placed), degrees);
  await Promise.all(turned.map((n) => members.place(n.id, { x: n.x, y: n.y, rotation: n.rotation })));
  return { outcome: MoveOutcome.Done, frameId: id, clipId: '', created: false, versions: {}, undo: [], turn: { id, degrees } };
}

export async function scaleNodeGroup(members: Members, id: string, to: { w: number; h: number }): Promise<Moved> {
  const [group] = await members.read([id]);
  if (!group) {
    return refused(MoveOutcome.NotFound, `no group ${id}`);
  }
  const placed = (m: Member): Placed => ({ id: m.id, x: m.box.left, y: m.box.top, w: m.box.width, h: m.box.height, rotation: m.rotation });
  const scaled = scaleGroup(placed(group), (await members.inGroup(id)).map(placed), to);
  await Promise.all(scaled.map((n) => members.resize(n.id, { x: n.x, y: n.y, w: n.w, h: n.h })));
  return { outcome: MoveOutcome.Done, frameId: id, clipId: '', created: false, versions: {}, undo: [] };
}

export async function moveNodeGroup(members: Members, id: string, to: { x: number; y: number }): Promise<Moved> {
  const [group] = await members.read([id]);
  if (!group) {
    return refused(MoveOutcome.NotFound, `no group ${id}`);
  }
  const delta = { dx: to.x - group.box.left, dy: to.y - group.box.top };
  const inside = await members.inGroup(id);
  const moves = translateGroup([{ id, x: group.box.left, y: group.box.top }, ...inside.map((m) => ({ id: m.id, x: m.box.left, y: m.box.top }))], delta);
  const rotation = new Map([group, ...inside].map((m) => [m.id, m.rotation]));
  await Promise.all(moves.map((m) => members.place(m.id, { x: m.x, y: m.y, rotation: rotation.get(m.id) ?? 0 })));
  return { outcome: MoveOutcome.Done, frameId: id, clipId: '', created: false, versions: {}, undo: [] };
}
