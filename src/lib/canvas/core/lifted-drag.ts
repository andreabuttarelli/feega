import { ItemKind, type DisplayList, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Splice } from '@feega/motion-core/motion/gpu-full/wire';
import type { HeldFrame } from './residency';
import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ancestorsOf } from '@feega/motion-core/motion/parent';

export type Lift = { id: string; key: number; clips: ReadonlySet<string>; by: [number, number]; landing: boolean };

export type Lifted = { rest: DisplayList; moving: DisplayList; splice: Splice };

const MOVING = ':moving';

export const movingGroup = (group: string) => `${group}${MOVING}`;

export const restGroup = (group: string) => `${group}:rest`;

const drawsAnyOf = (item: Item, clips: ReadonlySet<string>): boolean => clips.has(item.clip) || (item.kind === ItemKind.Group && item.items.some((i) => drawsAnyOf(i, clips)));

export function liftOut(list: DisplayList, clips: ReadonlySet<string>): Lifted | null {
  const owned = list.items.map((i) => clips.has(i.clip));
  const head = owned.indexOf(true);
  const end = owned.lastIndexOf(true) + 1;
  if (head < 0) {
    return null;
  }

  const moving = list.items.slice(head, end);
  const rest = [...list.items.slice(0, head), ...list.items.slice(end)];
  if (!moving.every((i) => clips.has(i.clip)) || rest.some((i) => drawsAnyOf(i, clips))) {
    return null;
  }

  return { rest: { ...list, items: rest }, moving: { ...list, items: moving, unsupported: [] }, splice: { head, tail: list.items.length - end, items: [] } };
}

export function liftedPut(frame: HeldFrame, group: string, by: [number, number]): HeldFrame {
  const scale = frame.box.w / frame.size.width;
  return { ...frame, id: `${frame.id}${MOVING}`, group, box: { ...frame.box, x: frame.box.x + by[0] * scale, y: frame.box.y + by[1] * scale } };
}

export function subtreeOf(doc: MotionDoc, ids: readonly string[]): Set<string> {
  return new Set(clipsOf(doc).map((c) => c.id).filter((id) => ids.includes(id) || ancestorsOf(doc, id).some((a) => ids.includes(a))));
}
