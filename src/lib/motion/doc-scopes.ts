import type { MotionDoc, MotionTrack } from '@feega/motion-core/motion/doc';
import { mergeView, viewOf } from '@feega/motion-core/motion/precomp';
import type { OpResult } from '@feega/motion-core/motion/timeline';

export type ScopeEdit = (view: MotionDoc, rootUnit: number) => OpResult;

export function inEveryScope(doc: MotionDoc, edit: ScopeEdit): OpResult {
  const top = edit(doc, 1);
  if (!top.ok) {
    return top;
  }
  let next = top.doc;
  for (const id of Object.keys(next.comps)) {
    const view = viewOf(next, [id]);
    const done = edit(view, next.width / view.width);
    if (!done.ok) {
      return done;
    }
    next = mergeView(next, [id], done.doc);
  }
  return { ok: true, doc: next };
}

export function mapEveryTrack(doc: MotionDoc, map: (tracks: MotionTrack[]) => MotionTrack[]): MotionDoc {
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: map(comp.tracks) }]));
  return { ...doc, tracks: map(doc.tracks), comps };
}
