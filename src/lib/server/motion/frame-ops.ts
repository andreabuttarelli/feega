import type { Db } from '$lib/server/db/client';
import { formatOf, type MotionDoc } from '$lib/motion/doc';
import type { MotionNode } from '$lib/canvas/motion-node';
import { applyOps, diffDoc, type DocOp } from '$lib/motion/doc-ops';
import { RevisionOutcome, readRevision, type MotionHead, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import type { Actor } from '$lib/server/repos/actor';
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

type FrameScope = { orgId: string; nodeId: string; node: Pick<MotionNode, 'format'> };

export type OpsAsk = FrameScope & { baseVersion: number; ops: readonly DocOp[]; actor: Actor; summary: string | null };

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

    const write = await saveMotionDoc(db, { ...scope, expectedVersion: head.version, doc: applyOps(head.doc, ask.ops), actor: ask.actor, summary: ask.summary });
    if (write.outcome === RevisionOutcome.Written) {
      return { outcome: OpsOutcome.Written, head: write.head, rebased };
    }
    if (write.outcome === RevisionOutcome.Invalid) {
      return { outcome: OpsOutcome.Invalid, error: write.error };
    }
  }
  return { outcome: OpsOutcome.Busy };
}

export type DocAsk = FrameScope & { base: { version: number; doc: MotionDoc }; doc: MotionDoc; actor: Actor; summary: string | null };

export function commitDoc(db: Db, ask: DocAsk): Promise<OpsCommit> {
  return commitOps(db, { ...ask, baseVersion: ask.base.version, ops: diffDoc(ask.base.doc, ask.doc) });
}

const REVISION_WRITE: { [K in OpsOutcome]: (commit: Extract<OpsCommit, { outcome: K }>) => RevisionWrite } = {
  [OpsOutcome.Written]: (commit) => ({ outcome: RevisionOutcome.Written, head: commit.head }),
  [OpsOutcome.Invalid]: (commit) => ({ outcome: RevisionOutcome.Invalid, error: commit.error }),
  [OpsOutcome.Busy]: () => ({ outcome: RevisionOutcome.Conflict })
};

export function revisionWriteOf(commit: OpsCommit): RevisionWrite {
  return (REVISION_WRITE[commit.outcome] as (commit: OpsCommit) => RevisionWrite)(commit);
}

export type OntoAsk = { orgId: string; nodeId: string; expectedVersion: number; doc: MotionDoc; actor: Actor; summary: string | null };

export async function commitOnto(db: Db, ask: OntoAsk): Promise<RevisionWrite> {
  const base = ask.expectedVersion > 0 ? await readRevision(db, { orgId: ask.orgId, nodeId: ask.nodeId, version: ask.expectedVersion }) : null;
  if (!base) {
    return saveMotionDoc(db, ask);
  }
  const node = { format: formatOf(ask.doc) };
  return revisionWriteOf(await commitDoc(db, { ...ask, node, base: { version: ask.expectedVersion, doc: base.doc } }));
}
