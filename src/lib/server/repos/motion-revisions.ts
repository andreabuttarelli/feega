import type { Db } from '$lib/server/db/client';
import { parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { actorCols, type Actor } from './actor';

export type MotionHead = { version: number; doc: MotionDoc; summary: string | null; actorKind: string };

export enum RevisionOutcome {
  Written = 'written',
  Conflict = 'conflict',
  Invalid = 'invalid'
}

export type RevisionWrite =
  | { outcome: RevisionOutcome.Written; head: MotionHead }
  | { outcome: RevisionOutcome.Conflict }
  | { outcome: RevisionOutcome.Invalid; error: string };

const UNIQUE_VIOLATION = '23505';
const SUMMARY_MAX = 300;

type RevisionRow = { version: number; doc: unknown; summary: string | null; actor_kind: string };

function headOf(row: RevisionRow): MotionHead | null {
  const parsed = parseMotionDoc(row.doc);
  if (!parsed.ok) {
    return null;
  }
  return { version: Number(row.version), doc: parsed.doc, summary: row.summary, actorKind: row.actor_kind };
}

export async function readHead(db: Db, input: { orgId: string; nodeId: string }): Promise<MotionHead | null> {
  const { data, error } = await db
    .from('motion_revisions')
    .select('version, doc, summary, actor_kind')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? headOf(data as RevisionRow) : null;
}

export async function appendRevision(
  db: Db,
  input: { orgId: string; nodeId: string; expectedVersion: number; doc: unknown; actor: Actor; summary?: string | null }
): Promise<RevisionWrite> {
  const parsed = parseMotionDoc(input.doc);
  if (!parsed.ok) {
    return { outcome: RevisionOutcome.Invalid, error: parsed.error };
  }

  const version = input.expectedVersion + 1;
  const summary = input.summary?.slice(0, SUMMARY_MAX) ?? null;
  const { error } = await db.from('motion_revisions').insert({
    org_id: input.orgId,
    node_id: input.nodeId,
    version,
    doc: parsed.doc,
    summary,
    ...actorCols(input.actor)
  } as never);

  if (error?.code === UNIQUE_VIOLATION) {
    return { outcome: RevisionOutcome.Conflict };
  }
  if (error) {
    throw error;
  }
  return { outcome: RevisionOutcome.Written, head: { version, doc: parsed.doc, summary, actorKind: input.actor.kind } };
}
