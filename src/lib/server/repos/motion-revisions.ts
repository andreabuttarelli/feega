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

const HEADS_KEPT = 64;

export type HeadCache = Map<string, MotionHead>;

export const headCache = (): HeadCache => new Map();

async function headVersion(db: Db, input: { orgId: string; nodeId: string }): Promise<number | null> {
  const { data, error } = await db
    .from('motion_revisions')
    .select('version')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? Number((data as { version: number }).version) : null;
}

function kept(cache: HeadCache, key: string, head: MotionHead): MotionHead {
  cache.delete(key);
  cache.set(key, head);
  if (cache.size > HEADS_KEPT) {
    cache.delete(cache.keys().next().value!);
  }
  return structuredClone(head);
}

export async function readHead(db: Db, input: { orgId: string; nodeId: string }, cache?: HeadCache): Promise<MotionHead | null> {
  if (!cache) {
    return readFullHead(db, input);
  }
  const key = `${input.orgId}:${input.nodeId}`;
  const known = cache.get(key);
  if (known && (await headVersion(db, input)) === known.version) {
    return kept(cache, key, known);
  }
  const head = await readFullHead(db, input);
  return head ? kept(cache, key, head) : null;
}

async function readFullHead(db: Db, input: { orgId: string; nodeId: string }): Promise<MotionHead | null> {
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

export async function readHeads(db: Db, input: { orgId: string; heads: { nodeId: string; version: number }[] }): Promise<Map<string, MotionHead>> {
  if (!input.heads.length) {
    return new Map();
  }

  const { data, error } = await db
    .from('motion_revisions')
    .select('node_id, version, doc, summary, actor_kind')
    .eq('org_id', input.orgId)
    .or(input.heads.map((h) => `and(node_id.eq.${h.nodeId},version.eq.${h.version})`).join(','));

  if (error) {
    throw error;
  }
  return new Map(
    ((data ?? []) as (RevisionRow & { node_id: string })[]).flatMap((row) => {
      const head = headOf(row);
      return head ? [[row.node_id, head] as const] : [];
    })
  );
}

export async function readRevision(db: Db, input: { orgId: string; nodeId: string; version: number }): Promise<MotionHead | null> {
  const { data, error } = await db
    .from('motion_revisions')
    .select('version, doc, summary, actor_kind')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .eq('version', input.version)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? headOf(data as RevisionRow) : null;
}

export async function readCheckpoint(db: Db, input: { orgId: string; nodeId: string; version: number }): Promise<MotionHead | null> {
  const { data, error } = await db
    .from('motion_revisions')
    .select('version, doc, summary, actor_kind')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .gte('version', input.version)
    .order('version', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? headOf(data as RevisionRow) : null;
}

export const REVISION_LIST_LIMIT = 30;

export type RevisionListing = { version: number; summary: string | null; actorKind: string; createdAt: string; clips: number };

type ListedRow = { version: number; doc: { tracks?: { clips?: unknown[] }[] } | null; summary: string | null; actor_kind: string; created_at?: string };

export async function listRevisions(db: Db, input: { orgId: string; nodeId: string }): Promise<RevisionListing[]> {
  const { data, error } = await db
    .from('motion_revisions')
    .select('version, doc, summary, actor_kind, created_at')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .order('version', { ascending: false })
    .limit(REVISION_LIST_LIMIT);

  if (error) {
    throw error;
  }
  return ((data ?? []) as ListedRow[]).map((row) => ({
    version: Number(row.version),
    summary: row.summary,
    actorKind: row.actor_kind,
    createdAt: row.created_at ?? '',
    clips: (row.doc?.tracks ?? []).reduce((n, t) => n + (t.clips?.length ?? 0), 0)
  }));
}

export enum Checkpoint {
  Coalesce = 'coalesce',
  Cut = 'cut'
}

export const CHECKPOINT_IDLE_MS = 3_000;

const COALESCE_MS: Record<Checkpoint, number> = { [Checkpoint.Coalesce]: CHECKPOINT_IDLE_MS, [Checkpoint.Cut]: 0 };

const FUNCTION_MISSING = 'PGRST202';

type CommitArgs = { orgId: string; nodeId: string; expectedVersion: number; doc: MotionDoc; actor: Actor; summary: string | null; checkpoint: Checkpoint };

async function insertRevision(db: Db, input: CommitArgs): Promise<boolean> {
  const { error } = await db.from('motion_revisions').insert({
    org_id: input.orgId,
    node_id: input.nodeId,
    version: input.expectedVersion + 1,
    doc: input.doc,
    summary: input.summary,
    ...actorCols(input.actor)
  } as never);
  if (error?.code === UNIQUE_VIOLATION) {
    return false;
  }
  if (error) {
    throw error;
  }
  return true;
}

async function commitRevision(db: Db, input: CommitArgs): Promise<boolean> {
  const { data, error } = await (db as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }> }).rpc('commit_motion_revision', {
    p_org_id: input.orgId,
    p_node_id: input.nodeId,
    p_expected: input.expectedVersion,
    p_doc: input.doc,
    p_summary: input.summary,
    p_actor_kind: input.actor.kind,
    p_actor_id: input.actor.id ?? null,
    p_agent_key: input.actor.agentKey ?? null,
    p_coalesce_ms: COALESCE_MS[input.checkpoint]
  });
  if (error?.code === FUNCTION_MISSING) {
    return insertRevision(db, input);
  }
  if (error) {
    throw error;
  }
  return data !== null;
}

export async function appendRevision(
  db: Db,
  input: { orgId: string; nodeId: string; expectedVersion: number; doc: unknown; actor: Actor; summary?: string | null; checkpoint?: Checkpoint }
): Promise<RevisionWrite> {
  const parsed = parseMotionDoc(input.doc);
  if (!parsed.ok) {
    return { outcome: RevisionOutcome.Invalid, error: parsed.error };
  }

  const summary = input.summary?.slice(0, SUMMARY_MAX) ?? null;
  const written = await commitRevision(db, { ...input, doc: parsed.doc, summary, checkpoint: input.checkpoint ?? Checkpoint.Cut });
  if (!written) {
    return { outcome: RevisionOutcome.Conflict };
  }
  return { outcome: RevisionOutcome.Written, head: { version: input.expectedVersion + 1, doc: parsed.doc, summary, actorKind: input.actor.kind } };
}

export async function sealRevision(db: Db, input: { orgId: string; nodeId: string; version: number }): Promise<void> {
  await db.from('motion_revisions').update({ sealed: true } as never).eq('org_id', input.orgId).eq('node_id', input.nodeId).eq('version', input.version);
}
