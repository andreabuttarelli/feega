import type { MotionDoc } from './doc';
import type { EditMode } from './edit-mode';
import { snapMove, type Bounds, type Guide, type Pt } from './scene-select';
import { moveBy } from './space';
import type { OpResult } from './timeline';

export const toggled = (ids: readonly string[], id: string): string[] => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

export const rectOf = (a: Pt, b: Pt): Bounds => ({ left: Math.min(a[0], b[0]), top: Math.min(a[1], b[1]), right: Math.max(a[0], b[0]), bottom: Math.max(a[1], b[1]) });

export function unionBounds(all: readonly Bounds[]): Bounds {
  return { left: Math.min(...all.map((b) => b.left)), top: Math.min(...all.map((b) => b.top)), right: Math.max(...all.map((b) => b.right)), bottom: Math.max(...all.map((b) => b.bottom)) };
}

const touches = (a: Bounds, b: Bounds) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

export function swept(bounds: Record<string, Bounds>, rect: Bounds, base: readonly string[]): string[] {
  const hits = Object.keys(bounds).filter((id) => !base.includes(id) && touches(bounds[id], rect));
  return [...base, ...hits];
}

type GroupMove = {
  doc: MotionDoc;
  ids: readonly string[];
  frame: number;
  mode: EditMode;
  offset: Pt;
  box: Bounds;
  others: Bounds[];
  size: { width: number; height: number };
  reach: number;
};

export function groupMove(input: GroupMove): { result: OpResult; guides: Guide[] } {
  const snapped = input.reach > 0 ? snapMove(input.box, input.offset, input.others, input.size, input.reach) : { offset: input.offset, guides: [] };
  return { result: moveBy(input.doc, input.ids, input.frame, snapped.offset, input.mode), guides: snapped.guides };
}
