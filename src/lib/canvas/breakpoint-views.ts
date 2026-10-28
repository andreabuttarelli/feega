import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { viewsOf } from '@feega/motion-core/motion/breakpoints/model';
import type { FrameAt } from '$lib/canvas/core/frame-source';

export const VIEW_GAP = 80;
const SEPARATOR = '@bp:';

export type BreakpointView = { frame: FrameAt; nodeId: string; breakpointId: string; name: string; width: number };

export const viewId = (nodeId: string, breakpointId: string) => `${nodeId}${SEPARATOR}${breakpointId}`;

export function viewOf(id: string): { nodeId: string; breakpointId: string } | null {
  const at = id.indexOf(SEPARATOR);
  if (at < 0) {
    return null;
  }
  return { nodeId: id.slice(0, at), breakpointId: id.slice(at + SEPARATOR.length) };
}

function viewsOfFrame(frame: FrameAt, doc: MotionDoc): BreakpointView[] {
  const scale = frame.box.w / doc.width;
  let x = frame.box.x + frame.box.w + VIEW_GAP;

  return viewsOf(doc)
    .slice(1)
    .map((bp) => {
      const box = { x, y: frame.box.y, w: bp.width * scale, h: frame.box.h };
      x += box.w + VIEW_GAP;
      return { frame: { id: viewId(frame.id, bp.id), kind: frame.kind, revision: frame.revision, box }, nodeId: frame.id, breakpointId: bp.id, name: bp.name, width: bp.width };
    });
}

export function breakpointViews(frames: readonly FrameAt[], docOf: (id: string) => MotionDoc | null | undefined): BreakpointView[] {
  return frames.flatMap((frame) => {
    const doc = docOf(frame.id);
    return doc?.breakpoints?.length ? viewsOfFrame(frame, doc) : [];
  });
}

export function viewAt(views: readonly BreakpointView[], p: { x: number; y: number }): BreakpointView | null {
  return views.find(({ frame: { box } }) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) ?? null;
}
