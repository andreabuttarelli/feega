import { findClip, type MotionClip, type MotionDoc } from '../doc';
import type { Box } from '../layout';
import { pivotBox } from '../parent';
import { Direction } from './auto-layout';
import type { AutoLayout, Padding } from './model';
import { reorderChild } from './ops';
import { childrenInOrder, withAutoLayout } from './resolve';
import type { OpResult } from '../timeline';

export type Side = keyof Padding;
export type Pt = [number, number];

export enum StripKind {
  Padding = 'padding',
  Gap = 'gap'
}

export type Strip = { kind: StripKind.Padding; side: Side; box: Box } | { kind: StripKind.Gap; box: Box };

type Container = MotionClip & { autoLayout: AutoLayout };
type Axis = { main: 0 | 1; start: 'left' | 'top'; length: 'width' | 'height'; crossStart: 'left' | 'top'; crossLength: 'width' | 'height' };

const AXIS: Record<Direction, Axis> = {
  [Direction.Horizontal]: { main: 0, start: 'left', length: 'width', crossStart: 'top', crossLength: 'height' },
  [Direction.Vertical]: { main: 1, start: 'top', length: 'height', crossStart: 'left', crossLength: 'width' }
};

const PADDING_GROWS: Record<Side, (delta: Pt) => number> = {
  top: ([, dy]) => dy,
  bottom: ([, dy]) => -dy,
  left: ([dx]) => dx,
  right: ([dx]) => -dx
};

function laid(doc: MotionDoc, containerId: string): { container: Container; box: Box; kids: { id: string; box: Box }[] } | null {
  const resolved = withAutoLayout(doc);
  const container = findClip(resolved, containerId)?.clip;
  if (!container?.autoLayout) {
    return null;
  }
  const size = { width: doc.width, height: doc.height };
  const all = resolved.tracks.flatMap((t) => t.clips as MotionClip[]);
  const kids = childrenInOrder(all, container as Container)
    .filter((c) => !c.layoutItem?.absolute)
    .map((c) => ({ id: c.id, box: pivotBox(c.props, size) }));
  return { container: container as Container, box: pivotBox(container.props, size), kids };
}

export function layoutStrips(doc: MotionDoc, containerId: string): Strip[] {
  const found = laid(doc, containerId);
  if (!found) {
    return [];
  }
  const { box, kids } = found;
  const { padding, direction } = found.container.autoLayout;
  const ax = AXIS[direction];
  const sides: Strip[] = [
    { kind: StripKind.Padding, side: 'top', box: { left: box.left, top: box.top, width: box.width, height: padding.top } },
    { kind: StripKind.Padding, side: 'bottom', box: { left: box.left, top: box.top + box.height - padding.bottom, width: box.width, height: padding.bottom } },
    { kind: StripKind.Padding, side: 'left', box: { left: box.left, top: box.top, width: padding.left, height: box.height } },
    { kind: StripKind.Padding, side: 'right', box: { left: box.left + box.width - padding.right, top: box.top, width: padding.right, height: box.height } }
  ];
  const gaps: Strip[] = kids.slice(1).flatMap((next, i) => {
    const prev = kids[i].box;
    const from = prev[ax.start] + prev[ax.length];
    const to = next.box[ax.start];
    if (to < from) {
      return [];
    }
    const crossFrom = Math.min(prev[ax.crossStart], next.box[ax.crossStart]);
    const crossTo = Math.max(prev[ax.crossStart] + prev[ax.crossLength], next.box[ax.crossStart] + next.box[ax.crossLength]);
    const strip = { [ax.start]: from, [ax.length]: to - from, [ax.crossStart]: crossFrom, [ax.crossLength]: crossTo - crossFrom } as Box;
    return [{ kind: StripKind.Gap, box: strip }];
  });
  return [...sides, ...gaps];
}

export function dragStrip(layout: AutoLayout, strip: Strip, delta: Pt): Partial<AutoLayout> {
  if (strip.kind === StripKind.Gap) {
    return { gap: Math.max(0, Math.round(layout.gap + delta[AXIS[layout.direction].main])) };
  }
  const value = Math.max(0, Math.round(layout.padding[strip.side] + PADDING_GROWS[strip.side](delta)));
  return { padding: { ...layout.padding, [strip.side]: value } };
}

export function reorderAt(doc: MotionDoc, clipId: string, point: Pt): OpResult | null {
  const parentId = findClip(doc, clipId)?.clip.parent;
  const found = parentId ? laid(doc, parentId) : null;
  if (!found || !found.kids.some((k) => k.id === clipId)) {
    return null;
  }
  const ax = AXIS[found.container.autoLayout.direction];
  const cross = 1 - ax.main;
  const before = (b: Box) => b[ax.crossStart] + b[ax.crossLength] < point[cross] || (b[ax.crossStart] <= point[cross] && b[ax.start] + b[ax.length] / 2 < point[ax.main]);
  const index = found.kids.filter((k) => k.id !== clipId && before(k.box)).length;
  return reorderChild(doc, found.container.id, clipId, index);
}
