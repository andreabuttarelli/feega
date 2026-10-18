import type { MotionDoc } from './doc';
import { applyOps, diffDoc, rebase, type DocOp } from './doc-ops';
import type { Revision } from './frame-sync';

export type Draft = { baseVersion: number; ops: readonly DocOp[] };

export function withDrafts(base: Revision, present: MotionDoc, drafts: readonly Draft[]): MotionDoc {
  const live = drafts.filter((d) => d.baseVersion === base.version && d.ops.length);
  if (!live.length) {
    return present;
  }
  const theirs = applyOps(base.doc, live.flatMap((d) => d.ops));
  return rebase(base.doc, present, theirs);
}

export function ownEdit(seen: MotionDoc, next: MotionDoc, present: MotionDoc): MotionDoc {
  return applyOps(present, diffDoc(seen, next));
}
