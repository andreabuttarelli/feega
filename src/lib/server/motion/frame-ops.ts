import type { Db } from '$lib/server/db/client';
import type { MotionDoc } from '$lib/motion/doc';
import type { MotionNode } from '$lib/canvas/motion-node';
import { applyOps, diffDoc, type DocOp } from '$lib/motion/doc-ops';
import { RevisionOutcome, type Checkpoint, type MotionHead, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import type { Actor } from '$lib/server/repos/actor';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { headOrNew, saveMotionDoc } from './editor';

export enum OpsOutcome {
  Written = 'written',
  Invalid = 'invalid',
  Busy = 'busy'
}

export type OpsCommit =
  | { outcome: OpsOutcome.Written; head: MotionHead; rebased: boolean }
  | { outcome: OpsOutcome.Invalid; error: string }
  | { outcome: OpsOutcome.Busy };

type FrameScope = { orgId: string; nodeId: string; node: MotionNode };

export type OpsAsk = FrameScope & { baseVersion: number; ops: readonly DocOp[]; actor: Actor; summary: string | null; checkpoint?: Checkpoint };

export const COMMIT_ATTEMPTS = 5;

export async function commitOps(db: Db, ask: OpsAsk): Promise<OpsCommit> {
  const scope = { orgId: ask.orgId, nodeId: ask.nodeId };

  for (let attempt = 0; attempt < COMMIT_ATTEMPTS; attempt++) {
    const head = await headOrNew(db, scope, ask.node);
    if (ask.baseVersion > head.version) {
      return { outcome: OpsOutcome.Invalid, error: `revision ${ask.baseVersion} does not exist yet: the frame is at ${head.version}` };
    }
    const rebased = head.version !== ask.baseVersion;
    if (!ask.ops.length) {
      return { outcome: OpsOutcome.Written, head, rebased };
    }

    const write = await saveMotionDoc(db, { ...scope, expectedVersion: head.version, doc: applyOps(head.doc, ask.ops), actor: ask.actor, summary: ask.summary, checkpoint: ask.checkpoint });
    if (write.outcome === RevisionOutcome.Written) {
      return { outcome: OpsOutcome.Written, head: write.head, rebased };
    }
    if (write.outcome === RevisionOutcome.Invalid) {
      return { outcome: OpsOutcome.Invalid, error: write.error };
    }
  }
  return { outcome: OpsOutcome.Busy };
}

export type DocAsk = FrameScope & { base: { version: number; doc: MotionDoc }; doc: MotionDoc; actor: Actor; summary: string | null; record?: CanvasNodeRecord; checkpoint?: Checkpoint };

export async function commitDoc(db: Db, ask: DocAsk): Promise<OpsCommit> {
  const ops = diffDoc(ask.base.doc, ask.doc);
  if (!ops.length) {
    return { outcome: OpsOutcome.Written, head: { ...ask.base, summary: null, actorKind: ask.actor.kind }, rebased: false };
  }

  const write = await saveMotionDoc(db, { orgId: ask.orgId, nodeId: ask.nodeId, expectedVersion: ask.base.version, doc: ask.doc, actor: ask.actor, summary: ask.summary, known: ask.record, checkpoint: ask.checkpoint });
  if (write.outcome === RevisionOutcome.Written) {
    return { outcome: OpsOutcome.Written, head: write.head, rebased: false };
  }
  if (write.outcome === RevisionOutcome.Invalid) {
    return { outcome: OpsOutcome.Invalid, error: write.error };
  }
  return commitOps(db, { ...ask, baseVersion: ask.base.version, ops });
}

const REVISION_WRITE: { [K in OpsOutcome]: (commit: Extract<OpsCommit, { outcome: K }>) => RevisionWrite } = {
  [OpsOutcome.Written]: (commit) => ({ outcome: RevisionOutcome.Written, head: commit.head }),
  [OpsOutcome.Invalid]: (commit) => ({ outcome: RevisionOutcome.Invalid, error: commit.error }),
  [OpsOutcome.Busy]: () => ({ outcome: RevisionOutcome.Conflict })
};

export function revisionWriteOf(commit: OpsCommit): RevisionWrite {
  return (REVISION_WRITE[commit.outcome] as (commit: OpsCommit) => RevisionWrite)(commit);
}
