import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, findNode, patchNodeData, writeNodeData } from '$lib/server/repos/canvas';
import { RevisionOutcome, appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { Attempt, Resolution, closeConflict, findConflict, type CanvasConflict } from '$lib/server/repos/canvas-conflicts';

export enum ResolveOutcome {
  Resolved = 'resolved',
  NotFound = 'not_found',
  AlreadyResolved = 'already_resolved',
  NodeGone = 'node_gone',
  Refused = 'refused'
}

export type ResolveAsk = { orgId: string; canvasId: string; conflictId: string; resolution: Resolution; actor: Actor };

export type Resolved = { outcome: ResolveOutcome; error?: string };

type Reapply = (db: Db, ask: ResolveAsk, conflict: CanvasConflict) => Promise<Resolved>;

async function replaceAgain(db: Db, ask: ResolveAsk, conflict: CanvasConflict): Promise<Resolved> {
  const current = await findNode(db, { orgId: ask.orgId, nodeId: conflict.nodeId });
  if (!current) {
    return { outcome: ResolveOutcome.NodeGone };
  }
  const written = await writeNodeData(db, { orgId: ask.orgId, nodeId: conflict.nodeId, data: conflict.attempted, expectedVersion: current.version, actor: ask.actor });
  return written.outcome === 'written' ? { outcome: ResolveOutcome.Resolved } : { outcome: ResolveOutcome.Refused, error: 'changed_again' };
}

async function patchAgain(db: Db, ask: ResolveAsk, conflict: CanvasConflict): Promise<Resolved> {
  const written = await patchNodeData(db, { orgId: ask.orgId, nodeId: conflict.nodeId, patch: conflict.attempted, check: DataCheck.Schema, actor: ask.actor });
  const outcomes: Record<typeof written.outcome, Resolved> = {
    written: { outcome: ResolveOutcome.Resolved },
    gone: { outcome: ResolveOutcome.NodeGone },
    conflict: { outcome: ResolveOutcome.Refused, error: 'changed_again' },
    invalid: { outcome: ResolveOutcome.Refused, error: 'error' in written ? written.error : 'invalid' }
  };
  return outcomes[written.outcome];
}

async function commitAgain(db: Db, ask: ResolveAsk, conflict: CanvasConflict): Promise<Resolved> {
  const head = await readHead(db, { orgId: ask.orgId, nodeId: conflict.nodeId });
  if (!head) {
    return { outcome: ResolveOutcome.NodeGone };
  }
  const written = await appendRevision(db, { orgId: ask.orgId, nodeId: conflict.nodeId, expectedVersion: head.version, doc: conflict.attempted.doc, actor: ask.actor });
  return written.outcome === RevisionOutcome.Written ? { outcome: ResolveOutcome.Resolved } : { outcome: ResolveOutcome.Refused, error: written.outcome };
}

const KEEP_MINE: Record<Attempt, Reapply> = { [Attempt.Replace]: replaceAgain, [Attempt.Patch]: patchAgain, [Attempt.MotionHead]: commitAgain };

const keepTheirs: Reapply = async () => ({ outcome: ResolveOutcome.Resolved });

const RESOLVERS: Record<Resolution, Reapply> = {
  [Resolution.Mine]: (db, ask, conflict) => KEEP_MINE[conflict.attempt](db, ask, conflict),
  [Resolution.Theirs]: keepTheirs
};

export async function resolveConflict(db: Db, ask: ResolveAsk): Promise<Resolved> {
  const conflict = await findConflict(db, { orgId: ask.orgId, canvasId: ask.canvasId, conflictId: ask.conflictId });
  if (!conflict) {
    return { outcome: ResolveOutcome.NotFound };
  }
  if (conflict.resolvedAt) {
    return { outcome: ResolveOutcome.AlreadyResolved };
  }

  const applied = await RESOLVERS[ask.resolution](db, ask, conflict);
  if (applied.outcome !== ResolveOutcome.Resolved) {
    return applied;
  }

  const closed = await closeConflict(db, { orgId: ask.orgId, conflictId: ask.conflictId, resolution: ask.resolution, actor: ask.actor });
  return closed ? applied : { outcome: ResolveOutcome.AlreadyResolved };
}
