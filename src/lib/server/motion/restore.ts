import type { Db } from '$lib/server/db/client';
import type { MotionNode } from '$lib/canvas/motion-node';
import { RevisionOutcome, readRevision, type MotionHead } from '$lib/server/repos/motion-revisions';
import type { Actor } from '$lib/server/repos/actor';
import { headOrNew, saveMotionDoc } from './editor';

export enum Restore {
  Restored = 'restored',
  Missing = 'missing',
  Conflict = 'conflict'
}

export type Restored = { outcome: Restore.Restored; head: MotionHead } | { outcome: Restore.Missing } | { outcome: Restore.Conflict };

export async function restoreRevision(db: Db, input: { orgId: string; nodeId: string; node: MotionNode; version: number; actor: Actor }): Promise<Restored> {
  const scope = { orgId: input.orgId, nodeId: input.nodeId };
  const old = await readRevision(db, { ...scope, version: input.version });
  if (!old) {
    return { outcome: Restore.Missing };
  }

  const head = await headOrNew(db, scope, input.node);
  const write = await saveMotionDoc(db, { ...scope, expectedVersion: head.version, doc: old.doc, actor: input.actor, summary: `Restored version ${input.version}` });
  return write.outcome === RevisionOutcome.Written ? { outcome: Restore.Restored, head: write.head } : { outcome: Restore.Conflict };
}

