import type { MotionDoc } from './doc';
import { setParent } from './parent-ops';
import { duplicateClip, removeClips, splitClip, type OpResult } from './timeline';

export enum ClipOp {
  Split = 'split',
  Duplicate = 'duplicate',
  Delete = 'delete',
  Parent = 'parent'
}

export type ClipCtx = { doc: MotionDoc; selection: readonly string[]; frame: number; parent: string | null; newId: () => string };
export type ClipDone = { ok: true; doc: MotionDoc; summary: string; selection: string[] } | { ok: false; error: string };

type Step = (doc: MotionDoc, id: string) => OpResult;

function eachSelected(ctx: ClipCtx, step: Step): OpResult {
  let doc = ctx.doc;
  let error = 'nothing selected';
  for (const id of ctx.selection) {
    const result = step(doc, id);
    if (!result.ok) {
      error = result.error;
      continue;
    }
    doc = result.doc;
  }
  return doc === ctx.doc ? { ok: false, error } : { ok: true, doc };
}

function done(result: OpResult, summary: string, selection: string[]): ClipDone {
  return result.ok ? { ok: true, doc: result.doc, summary, selection } : result;
}

function duplicate(ctx: ClipCtx): ClipDone {
  const copies: string[] = [];
  const result = eachSelected(ctx, (doc, id) => {
    const copy = ctx.newId();
    const made = duplicateClip(doc, id, copy);
    if (made.ok) {
      copies.push(copy);
    }
    return made;
  });
  return done(result, 'Duplicated', copies);
}

const CLIP_OPS: Record<ClipOp, (ctx: ClipCtx) => ClipDone> = {
  [ClipOp.Split]: (ctx) => done(eachSelected(ctx, (doc, id) => splitClip(doc, id, ctx.frame, ctx.newId())), 'Split', [...ctx.selection]),
  [ClipOp.Duplicate]: duplicate,
  [ClipOp.Delete]: (ctx) => done(removeClips(ctx.doc, ctx.selection), 'Deleted', []),
  [ClipOp.Parent]: (ctx) => done(eachSelected(ctx, (doc, id) => setParent(doc, id, ctx.parent, { at: ctx.frame })), ctx.parent ? 'Parented' : 'Unparented', [...ctx.selection])
};

export const runClipOp = (op: ClipOp, ctx: ClipCtx): ClipDone => CLIP_OPS[op](ctx);
