import { z } from 'zod';
import { FrameKind, elementNodeOf, frameChrome } from '$lib/canvas/motion-node';
import { Background, type MotionDoc } from '$lib/motion/doc';
import { blankElement, type CanvasBox } from '$lib/motion/draw-create';
import { clipCentre, elementBox, frameOf, liftElement, placeElement, type Element } from '$lib/motion/move-element';
import { docMode } from '$lib/motion/still';
import { elementName } from '$lib/motion/element-name';
import { MoveOutcome, created, deleted, refused, type FrameStore, type Moved, type Place, type StoredFrame } from './move-element';

export const groupAskSchema = z.object({ ids: z.array(z.string().min(1)).min(2).max(50) }).strict();

const GROUP_NAME = 'Group';

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

function seenIn(element: Element, from: CanvasBox, sheet: MotionDoc, to: CanvasBox): Element {
  return { ...element, size: { width: (sheet.width * from.width) / to.width, height: (sheet.height * from.height) / to.height } };
}

function placeAll(sheet: MotionDoc, sources: readonly Free[], to: CanvasBox): MotionDoc | string {
  let doc = sheet;
  for (const source of sources) {
    for (const clip of topClips(source.doc)) {
      const lifted = liftElement(source.doc, clip.id);
      if (!lifted.ok) {
        return lifted.error;
      }
      const centre = clipCentre(clip);
      const at = { x: (source.box.left + centre.x * source.box.width - to.left) / to.width, y: (source.box.top + centre.y * source.box.height - to.top) / to.height };
      const placed = placeElement(doc, seenIn(lifted.element, source.box, doc, to), { at, frame: 0 }, newId);
      if (!placed.ok) {
        return placed.error;
      }
      doc = placed.doc;
    }
  }
  return doc;
}

export async function groupElements(store: FrameStore, place: Place, ids: readonly string[]): Promise<Moved> {
  const sources = await readFree(store, ids);
  if (!sources) {
    return refused(MoveOutcome.Invalid, 'only free elements on the canvas group');
  }
  const bounds = union(sources.map((s) => s.box));
  const sheet = blankElement(bounds);
  if (!sheet.ok) {
    return refused(MoveOutcome.Invalid, sheet.error);
  }
  const doc = placeAll(sheet.doc, sources, bounds);
  if (typeof doc === 'string') {
    return refused(MoveOutcome.Invalid, doc);
  }

  const shaped = elementNodeOf(bounds, FrameKind.Group);
  const at = { x: bounds.left, y: bounds.top };
  const groupId = await store.create({ ...place, ...at }, doc, { data: shaped.data, width: shaped.w, height: shaped.h, displayName: GROUP_NAME });
  await Promise.all(sources.map((s) => store.remove(s.nodeId)));
  return { outcome: MoveOutcome.Done, frameId: groupId, clipId: '', created: true, versions: { [groupId]: 1 }, undo: [created(groupId, at), ...sources.map(deleted)] };
}

export async function ungroupElement(store: FrameStore, place: Place, id: string): Promise<Moved> {
  const [group] = (await readFree(store, [id])) ?? [];
  const clips = group ? topClips(group.doc) : [];
  if (!group || clips.length < 2) {
    return refused(MoveOutcome.Invalid, 'not a group of free elements');
  }

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
    made.push({ id: await store.create({ ...place, ...at }, doc, { data: shaped.data, width: shaped.w, height: shaped.h, displayName: elementName(clip) }), at });
  }
  await store.remove(group.nodeId);
  const first = made[0]?.id ?? '';
  return { outcome: MoveOutcome.Done, frameId: first, clipId: '', created: true, versions: Object.fromEntries(made.map((m) => [m.id, 1])), undo: [...made.map((m) => created(m.id, m.at)), deleted(group)] };
}
