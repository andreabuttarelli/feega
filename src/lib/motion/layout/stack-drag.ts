import { findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import type { AutoLayout } from '@feega/motion-core/motion/layout/model';
import { childrenInOrder } from '@feega/motion-core/motion/layout/resolve';
import type { Box } from '@feega/motion-core/motion/layout';
import { KeepWorld, setParent } from '../parent-ops';
import { layoutParent, leaveStack, reorderChild } from './ops';

export const LEAVE_MARGIN_PX = 16;

export enum StackDrop {
  Reorder = 'reorder',
  Join = 'join',
  Leave = 'leave'
}

export type DropLine = { x1: number; y1: number; x2: number; y2: number };

export type StackDragged = { kind: StackDrop; result: OpResult; line: DropLine | null };

type Pt = readonly [number, number];
type Stack = MotionClip & { autoLayout: AutoLayout };

const allClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

const contains = (box: Box, [x, y]: Pt, margin: number) => x >= box.left - margin && y >= box.top - margin && x <= box.left + box.width + margin && y <= box.top + box.height + margin;

function within(doc: MotionDoc, id: string, ancestorId: string): boolean {
  for (let at = findClip(doc, id)?.clip.parent; at; at = findClip(doc, at)?.clip.parent) {
    if (at === ancestorId) {
      return true;
    }
  }
  return false;
}

function stackUnder(doc: MotionDoc, clipId: string, own: Stack, boxes: Record<string, Box>, to: Pt): Stack | null {
  const area = (c: MotionClip) => boxes[c.id].width * boxes[c.id].height;
  const hits = allClips(doc)
    .filter((c): c is Stack => !!c.autoLayout && !!boxes[c.id] && c.id !== clipId && !within(doc, c.id, clipId))
    .filter((c) => contains(boxes[c.id], to, c.id === own.id ? LEAVE_MARGIN_PX : 0))
    .sort((a, b) => area(a) - area(b));
  return hits[0] ?? null;
}

const MAIN = { [Direction.Horizontal]: 0, [Direction.Vertical]: 1, [Direction.Grid]: 0 } as const;

function slotOf(doc: MotionDoc, stack: Stack, clipId: string, boxes: Record<string, Box>, to: Pt): { index: number; line: DropLine } {
  const axis = MAIN[stack.autoLayout.direction];
  const siblings = childrenInOrder(allClips(doc), stack).filter((c) => c.id !== clipId && boxes[c.id]);
  const start = (b: Box) => (axis === 0 ? b.left : b.top);
  const size = (b: Box) => (axis === 0 ? b.width : b.height);
  const index = siblings.filter((c) => start(boxes[c.id]) + size(boxes[c.id]) / 2 < to[axis]).length;
  const half = stack.autoLayout.gap / 2;
  const own = boxes[stack.id];
  const before = siblings[index] ? start(boxes[siblings[index].id]) - half : null;
  const after = siblings[index - 1] ? start(boxes[siblings[index - 1].id]) + size(boxes[siblings[index - 1].id]) + half : null;
  const at = before ?? after ?? start(own);
  const line = axis === 0 ? { x1: at, y1: own.top, x2: at, y2: own.top + own.height } : { x1: own.left, y1: at, x2: own.left + own.width, y2: at };
  return { index, line };
}

function join(doc: MotionDoc, clipId: string, stack: Stack, index: number): OpResult {
  const left = leaveStack(doc, clipId);
  const placed = left.ok ? setParent(left.doc, clipId, stack.id, { keep: KeepWorld.No }) : left;
  return placed.ok ? reorderChild(placed.doc, stack.id, clipId, index) : placed;
}

function leave(doc: MotionDoc, clipId: string, to: Pt): OpResult {
  const left = leaveStack(doc, clipId);
  return left.ok ? setProps(left.doc, clipId, { x: to[0] / doc.width, y: to[1] / doc.height }) : left;
}

export function dragInStack(doc: MotionDoc, clipId: string, boxes: Record<string, Box>, to: Pt): StackDragged {
  const child = findClip(doc, clipId)?.clip as MotionClip | undefined;
  const own = child ? layoutParent(doc, child) : null;
  if (!own) {
    return { kind: StackDrop.Leave, result: { ok: false, error: `${clipId} is not in a stack` }, line: null };
  }
  const target = stackUnder(doc, clipId, own, boxes, to);
  if (!target) {
    return { kind: StackDrop.Leave, result: leave(doc, clipId, to), line: null };
  }
  const { index, line } = slotOf(doc, target, clipId, boxes, to);
  if (target.id === own.id) {
    return { kind: StackDrop.Reorder, result: reorderChild(doc, own.id, clipId, index), line };
  }
  return { kind: StackDrop.Join, result: join(doc, clipId, target, index), line };
}
