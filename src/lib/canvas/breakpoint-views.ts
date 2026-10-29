import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { viewsOf } from '@feega/motion-core/motion/breakpoints/model';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import type { FrameAt } from '$lib/canvas/core/frame-source';

export const VIEW_GAP = 80;
const SEPARATOR = '@bp:';

export type BreakpointView = { frame: FrameAt; nodeId: string; breakpointId: string; name: string; width: number; doc: MotionDoc };

export const viewId = (nodeId: string, breakpointId: string) => `${nodeId}${SEPARATOR}${breakpointId}`;

export function viewOf(id: string): { nodeId: string; breakpointId: string } | null {
  const at = id.indexOf(SEPARATOR);
  if (at < 0) {
    return null;
  }
  return { nodeId: id.slice(0, at), breakpointId: id.slice(at + SEPARATOR.length) };
}

export const baseNodeId = (id: string) => viewOf(id)?.nodeId ?? id;

export const withoutViews = <T extends { id: string }>(frames: readonly T[]): T[] => frames.filter((f) => !viewOf(f.id));

function viewsOfFrame(frame: FrameAt, doc: MotionDoc): BreakpointView[] {
  const scale = frame.box.w / doc.width;
  let x = frame.box.x + frame.box.w + VIEW_GAP;

  return viewsOf(doc)
    .slice(1)
    .map((bp) => {
      const view = resolveView(doc, bp.id);
      const box = { x, y: frame.box.y, w: bp.width * scale, h: view.height * scale };
      x += box.w + VIEW_GAP;
      return { frame: { id: viewId(frame.id, bp.id), kind: frame.kind, revision: frame.revision, box }, nodeId: frame.id, breakpointId: bp.id, name: bp.name, width: bp.width, doc: view };
    });
}

export function breakpointViews(frames: readonly FrameAt[], docOf: (id: string) => MotionDoc | null | undefined): BreakpointView[] {
  return frames.flatMap((frame) => {
    const doc = docOf(frame.id);
    return doc?.breakpoints?.length ? viewsOfFrame(frame, doc) : [];
  });
}

type Held = { stamp: string; doc: MotionDoc; views: BreakpointView[] };

const stampOf = ({ kind, revision, box }: FrameAt) => `${kind}|${revision}|${box.x}|${box.y}|${box.w}|${box.h}`;

export function heldViews() {
  const held = new Map<string, Held>();

  return (frames: readonly FrameAt[], docOf: (id: string) => MotionDoc | null | undefined): BreakpointView[] =>
    frames.flatMap((frame) => {
      const doc = docOf(frame.id);
      if (!doc?.breakpoints?.length) {
        return [];
      }
      const known = held.get(frame.id);
      const stamp = stampOf(frame);
      if (known && known.doc === doc && known.stamp === stamp) {
        return known.views;
      }
      const views = viewsOfFrame(frame, doc);
      held.set(frame.id, { stamp, doc, views });
      return views;
    });
}

export function viewAt(views: readonly BreakpointView[], p: { x: number; y: number }): BreakpointView | null {
  return views.find(({ frame: { box } }) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) ?? null;
}
