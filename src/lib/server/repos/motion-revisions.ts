import type { Db } from '$lib/server/db/client';
import { parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { actorCols, type Actor } from './actor';
import { Attempt, recordConflict } from './canvas-conflicts';
import { coreEvent } from '$lib/server/core-usage';
import { CoreEvent, type ActorKind } from '$lib/core-usage';

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

const PARSED_KEPT = 32;

const parsedRevisions = new Map<string, MotionHead>();

const revisionKey = (orgId: string, head: { nodeId: string; version: number }) => `${orgId}:${head.nodeId}:${head.version}`;

function keepParsed(key: string, head: MotionHead) {
  parsedRevisions.set(key, head);
  if (parsedRevisions.size > PARSED_KEPT) {
    parsedRevisions.delete(parsedRevisions.keys().next().value!);
  }
}

export async function readHeads(db: Db, input: { orgId: string; heads: { nodeId: string; version: number }[] }): Promise<Map<string, MotionHead>> {
  const known = input.heads.flatMap((h) => {
    const parsed = parsedRevisions.get(revisionKey(input.orgId, h));
    return parsed ? [[h.nodeId, parsed] as const] : [];
  });
  const missing = input.heads.filter((h) => !parsedRevisions.has(revisionKey(input.orgId, h)));
  if (!missing.length) {
    return new Map(known);
  }

  const { data, error } = await db
    .from('motion_revisions')
    .select('node_id, version, doc, summary, actor_kind')
    .eq('org_id', input.orgId)
    .or(missing.map((h) => `and(node_id.eq.${h.nodeId},version.eq.${h.version})`).join(','));

  if (error) {
    throw error;
  }
  const read = ((data ?? []) as (RevisionRow & { node_id: string })[]).flatMap((row) => {
    const head = headOf(row);
    if (!head) {
      return [];
    }
    keepParsed(revisionKey(input.orgId, { nodeId: row.node_id, version: head.version }), head);
    return [[row.node_id, head] as const];
  });
  return new Map([...known, ...read]);
}

export type HeadPointer = { nodeId: string; version: number | null };

const NEWEST_LANES = 8;

async function newestVersions(db: Db, input: { orgId: string; nodeIds: string[] }): Promise<{ nodeId: string; version: number }[]> {
  const found: { nodeId: string; version: number }[] = [];
  for (let at = 0; at < input.nodeIds.length; at += NEWEST_LANES) {
    const lane = input.nodeIds.slice(at, at + NEWEST_LANES);
    const versions = await Promise.all(lane.map(async (nodeId) => ({ nodeId, version: await headVersion(db, { orgId: input.orgId, nodeId }) })));
    found.push(...versions.flatMap((v) => (v.version === null ? [] : [{ nodeId: v.nodeId, version: v.version }])));
  }
  return found;
}

export async function latestHeads(db: Db, input: { orgId: string; frames: HeadPointer[] }): Promise<Map<string, MotionHead>> {
  const pointed = await readHeads(db, { orgId: input.orgId, heads: input.frames.flatMap((f) => (f.version ? [{ nodeId: f.nodeId, version: f.version }] : [])) });
  const unpointed = input.frames.filter((f) => !pointed.has(f.nodeId)).map((f) => f.nodeId);
  const newest = await readHeads(db, { orgId: input.orgId, heads: await newestVersions(db, { orgId: input.orgId, nodeIds: unpointed }) });
  const asked = new Set(input.frames.map((f) => f.nodeId));
  return new Map([...pointed, ...newest].filter(([nodeId]) => asked.has(nodeId)));
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

export type RevisionMark = { nodeId: string; version: number; summary: string | null; actorKind: string; actorId: string | null; agentKey: string | null; sessionId: string | null; createdAt: string };

type MarkRow = { node_id: string; version: number; summary: string | null; actor_kind: string; actor_id: string | null; agent_key: string | null; session_id?: string | null; created_at: string };

const MARK_COLUMNS = 'node_id, version, summary, actor_kind, actor_id, agent_key, created_at';
const UNDEFINED_COLUMN = '42703';

export async function listRevisionMarks(db: Db, input: { orgId: string; nodeIds: string[]; limit: number }): Promise<RevisionMark[]> {
  if (!input.nodeIds.length) {
    return [];
  }

  const marks = (columns: string) =>
    db.from('motion_revisions').select(columns).eq('org_id', input.orgId).in('node_id', input.nodeIds).order('created_at', { ascending: false }).limit(input.limit);
  const tried = await marks(`${MARK_COLUMNS}, session_id`);
  const { data, error } = tried.error?.code === UNDEFINED_COLUMN ? await marks(MARK_COLUMNS) : tried;

  if (error) {
    throw error;
  }
  return ((data ?? []) as unknown as MarkRow[]).map((row) => ({
    nodeId: row.node_id,
    version: Number(row.version),
    summary: row.summary,
    actorKind: row.actor_kind,
    actorId: row.actor_id,
    agentKey: row.agent_key,
    sessionId: row.session_id ?? null,
    createdAt: row.created_at
  }));
}

export enum Checkpoint {
  Coalesce = 'coalesce',
  Cut = 'cut'
}

export const CHECKPOINT_IDLE_MS = 3_000;

const COALESCE_MS: Record<Checkpoint, number> = { [Checkpoint.Coalesce]: CHECKPOINT_IDLE_MS, [Checkpoint.Cut]: 0 };

const FUNCTION_MISSING = 'PGRST202';
const COLUMN_MISSING = 'PGRST204';

type CommitArgs = { orgId: string; nodeId: string; expectedVersion: number; doc: MotionDoc; actor: Actor; summary: string | null; checkpoint: Checkpoint };

async function insertRevision(db: Db, input: CommitArgs): Promise<boolean> {
  const row = { node_id: input.nodeId, version: input.expectedVersion + 1, doc: input.doc, summary: input.summary, ...actorCols(input.actor) };
  const tried = await db.from('motion_revisions').insert({ org_id: input.orgId, ...row, session_id: input.actor.sessionId ?? null } as never);
  const { error } = tried.error?.code === COLUMN_MISSING ? await db.from('motion_revisions').insert({ org_id: input.orgId, ...row } as never) : tried;
  if (error?.code === UNIQUE_VIOLATION) {
    return false;
  }
  if (error) {
    console.error('motion_revisions insert failed', { nodeId: input.nodeId, version: input.expectedVersion + 1, error });
    throw error;
  }
  return true;
}

type RevisionRpc = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }> };

const STATEMENT_TIMEOUT = '57014';
const TIMEOUT_RETRIES_MS = [500, 1500, 3000];

async function patiently<T extends { error: { code?: string } | null }>(call: () => PromiseLike<T>): Promise<T> {
  let answer = await call();
  for (const wait of TIMEOUT_RETRIES_MS) {
    if (answer.error?.code !== STATEMENT_TIMEOUT) {
      return answer;
    }
    await new Promise((done) => setTimeout(done, wait));
    answer = await call();
  }
  return answer;
}

async function commitRevision(db: Db, input: CommitArgs): Promise<boolean> {
  const rpc = (args: Record<string, unknown>) => (db as unknown as RevisionRpc).rpc('commit_motion_revision', args);
  const args = {
    p_org_id: input.orgId,
    p_node_id: input.nodeId,
    p_expected: input.expectedVersion,
    p_doc: input.doc,
    p_summary: input.summary,
    p_actor_kind: input.actor.kind,
    p_actor_id: input.actor.id ?? null,
    p_agent_key: input.actor.agentKey ?? null,
    p_coalesce_ms: COALESCE_MS[input.checkpoint]
  };
  const tried = await patiently(() => rpc({ ...args, p_session_id: input.actor.sessionId ?? null }));
  const { data, error } = tried.error?.code === FUNCTION_MISSING ? await patiently(() => rpc(args)) : tried;
  if (error?.code === FUNCTION_MISSING) {
    return insertRevision(db, input);
  }
  if (error) {
    console.error('commit_motion_revision failed', { nodeId: input.nodeId, expected: input.expectedVersion, error });
    throw error;
  }
  return data !== null;
}

async function noteStaleHead(db: Db, input: { orgId: string; nodeId: string; expectedVersion: number; doc: MotionDoc; actor: Actor }): Promise<void> {
  const { data: node } = await db.from('nodes').select('canvas_id').eq('org_id', input.orgId).eq('id', input.nodeId).maybeSingle();
  if (!node) {
    return;
  }
  await recordConflict(db, {
    orgId: input.orgId,
    canvasId: node.canvas_id,
    nodeId: input.nodeId,
    expectedVersion: input.expectedVersion,
    actualVersion: await headVersion(db, input),
    attempt: Attempt.MotionHead,
    attempted: { doc: input.doc },
    winningEventId: null,
    actor: input.actor
  });
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
    await noteStaleHead(db, { ...input, doc: parsed.doc });
    return { outcome: RevisionOutcome.Conflict };
  }

  coreEvent(input.actor.id, input.expectedVersion === 0 ? CoreEvent.FrameCreated : CoreEvent.FrameEdited, { frame_id: input.nodeId, actor: input.actor.kind as ActorKind });
  return { outcome: RevisionOutcome.Written, head: { version: input.expectedVersion + 1, doc: parsed.doc, summary, actorKind: input.actor.kind } };
}

export async function sealRevision(db: Db, input: { orgId: string; nodeId: string; version: number }): Promise<void> {
  await db.from('motion_revisions').update({ sealed: true } as never).eq('org_id', input.orgId).eq('node_id', input.nodeId).eq('version', input.version);
}

export async function copyHead(db: Db, input: { orgId: string; from: string; to: string; actor: Actor }): Promise<void> {
  const head = await readFullHead(db, { orgId: input.orgId, nodeId: input.from });
  if (head) {
    await appendRevision(db, { orgId: input.orgId, nodeId: input.to, expectedVersion: 0, doc: head.doc, actor: input.actor });
  }
}
