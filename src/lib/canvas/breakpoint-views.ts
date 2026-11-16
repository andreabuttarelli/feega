import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { viewsOf, type Breakpoint } from '@feega/motion-core/motion/breakpoints/model';
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

const resolved = new WeakMap<MotionDoc, Map<string, MotionDoc>>();

export function resolvedViewDoc(doc: MotionDoc, breakpointId: string): MotionDoc {
  const byView = resolved.get(doc) ?? resolved.set(doc, new Map()).get(doc)!;
  return byView.get(breakpointId) ?? byView.set(breakpointId, resolveView(doc, breakpointId)).get(breakpointId)!;
}

export const resolvedViewDocs = (doc: MotionDoc, breakpointIds: readonly string[]): MotionDoc[] => breakpointIds.map((id) => resolvedViewDoc(doc, id));

const breakpointsOf = (doc: MotionDoc) => viewsOf(doc).slice(1);

function placedViews(frame: FrameAt, width: number, breakpoints: readonly Breakpoint[], docs: readonly MotionDoc[]): BreakpointView[] {
  const scale = frame.box.w / width;
  let x = frame.box.x + frame.box.w + VIEW_GAP;

  return breakpoints.map((bp, i) => {
    const view = docs[i];
    const box = { x, y: frame.box.y, w: bp.width * scale, h: view.height * scale };
    x += box.w + VIEW_GAP;
    return { frame: { id: viewId(frame.id, bp.id), kind: frame.kind, revision: frame.revision, box }, nodeId: frame.id, breakpointId: bp.id, name: bp.name, width: bp.width, doc: view };
  });
}

export function viewsOfFrame(frame: FrameAt, doc: MotionDoc): BreakpointView[] {
  const breakpoints = breakpointsOf(doc);
  return placedViews(frame, doc.width, breakpoints, resolvedViewDocs(doc, breakpoints.map((bp) => bp.id)));
}

export type ResolveViews = (doc: MotionDoc, breakpointIds: string[]) => Promise<MotionDoc[]>;

export type Later = { resolve: ResolveViews; landed: () => void };

type Shown = { width: number; breakpoints: Breakpoint[]; docs: MotionDoc[] };

type Held = { stamp: string; asked: MotionDoc; turn: number; landedTurn: number; shown: Shown; views: BreakpointView[] | null };

const stampOf = ({ kind, revision, box }: FrameAt) => `${kind}|${revision}|${box.x}|${box.y}|${box.w}|${box.h}`;

const shownNow = (doc: MotionDoc): Shown => {
  const breakpoints = breakpointsOf(doc);
  return { width: doc.width, breakpoints, docs: resolvedViewDocs(doc, breakpoints.map((bp) => bp.id)) };
};

export function heldViews(later?: Later) {
  const held = new Map<string, Held>();

  const ask = (id: string, entry: Held, doc: MotionDoc) => {
    const turn = ++entry.turn;
    const breakpoints = breakpointsOf(doc);
    const landed = (docs: MotionDoc[]) => {
      if (held.get(id) !== entry || turn <= entry.landedTurn) {
        return;
      }
      entry.landedTurn = turn;
      entry.shown = { width: doc.width, breakpoints, docs };
      entry.views = null;
      later!.landed();
    };
    later!.resolve(doc, breakpoints.map((bp) => bp.id)).then(landed, () => landed(resolvedViewDocs(doc, breakpoints.map((bp) => bp.id))));
  };

  const viewsFor = (frame: FrameAt, doc: MotionDoc): BreakpointView[] => {
    const stamp = stampOf(frame);
    const known = held.get(frame.id);
    if (!known || (!later && known.asked !== doc)) {
      const entry: Held = { stamp, asked: doc, turn: 0, landedTurn: 0, shown: shownNow(doc), views: null };
      held.set(frame.id, entry);
      return (entry.views = placedViews(frame, doc.width, entry.shown.breakpoints, entry.shown.docs));
    }
    if (known.asked !== doc) {
      known.asked = doc;
      ask(frame.id, known, doc);
    }
    if (known.views && known.stamp === stamp) {
      return known.views;
    }
    known.stamp = stamp;
    return (known.views = placedViews(frame, known.shown.width, known.shown.breakpoints, known.shown.docs));
  };

  const resolve = (frames: readonly FrameAt[], docOf: (id: string) => MotionDoc | null | undefined): BreakpointView[] =>
    frames.flatMap((frame) => {
      const doc = docOf(frame.id);
      return doc?.breakpoints?.length ? viewsFor(frame, doc) : [];
    });

  return Object.assign(resolve, { forget: (id: string) => held.delete(id) });
}

export function viewAt(views: readonly BreakpointView[], p: { x: number; y: number }): BreakpointView | null {
  return views.find(({ frame: { box } }) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) ?? null;
}
