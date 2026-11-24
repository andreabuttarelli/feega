import type { SupabaseClient } from '@supabase/supabase-js';
import { listComments, type Comment } from './comments';
import type { SessionRole, SessionRow } from './sessions';

export enum Verdict {
  Approved = 'approved',
  ChangesRequested = 'changes_requested'
}

export enum ReviewStatus {
  Open = 'open',
  ChangesRequested = 'changes_requested',
  Approved = 'approved'
}

const STATUS_RULES: readonly { verdict: Verdict; status: ReviewStatus }[] = [
  { verdict: Verdict.ChangesRequested, status: ReviewStatus.ChangesRequested },
  { verdict: Verdict.Approved, status: ReviewStatus.Approved }
];

export function statusOf(verdicts: readonly Verdict[]): ReviewStatus {
  return STATUS_RULES.find((rule) => verdicts.includes(rule.verdict))?.status ?? ReviewStatus.Open;
}

export enum RevisionCheck {
  Valid = 'valid',
  BadSummary = 'bad_summary',
  BadChanges = 'bad_changes'
}

export enum VerdictOutcome {
  Set = 'set',
  NotFound = 'not_found',
  OwnRevision = 'own_revision'
}

export type Change = { file: string; added: number; removed: number };

export type RevisionInput = { summary: string; changes: Change[] };

export type VerdictInput = { verdict: Verdict; note: string | null };

export type VerdictEntry = { reviewerId: string; reviewerName: string; verdict: Verdict; note: string | null; decidedAt: string };

export type Revision = {
  id: string;
  sessionId: string;
  number: number;
  authorId: string;
  summary: string;
  changes: Change[];
  createdAt: string;
  verdicts: VerdictEntry[];
  status: ReviewStatus;
};

export type Review = { status: ReviewStatus; revision: Revision | null; openComments: Comment[] };

const SUMMARY_MAX_CHARS = 2000;
const NOTE_MAX_CHARS = 2000;
const CHANGES_MAX = 500;
const FILE_MAX_CHARS = 1000;
const ABSOLUTE_PATH = /^([/\\]|[a-zA-Z]:)/;
const PARENT_SEGMENT = /(^|[/\\])\.\.([/\\]|$)/;
const NO_REVISIONS = 0;
const VERDICTS: readonly string[] = Object.values(Verdict);

type RevisionRow = { id: string; session_id: string; number: number; author_id: string; summary: string; changes: Change[]; created_at: string };

type VerdictRow = { revision_id: string; reviewer_id: string; reviewer_name: string; verdict: Verdict; note: string | null; decided_at: string };

function failure(error: { message: string }): Error {
  return new Error(`cloud revisions: ${error.message}`);
}

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isChange(value: unknown): value is Change {
  const change = value as Change | null;
  if (!change || typeof change.file !== 'string') {
    return false;
  }

  const safeFile = change.file.length > 0 && change.file.length <= FILE_MAX_CHARS && !ABSOLUTE_PATH.test(change.file) && !PARENT_SEGMENT.test(change.file);

  return safeFile && isCount(change.added) && isCount(change.removed);
}

export function readRevisionInput(raw: unknown): { check: RevisionCheck.Valid; input: RevisionInput } | { check: Exclude<RevisionCheck, RevisionCheck.Valid> } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (!summary || summary.length > SUMMARY_MAX_CHARS) {
    return { check: RevisionCheck.BadSummary };
  }

  const changes = body.changes;
  if (!Array.isArray(changes) || changes.length > CHANGES_MAX || !changes.every(isChange)) {
    return { check: RevisionCheck.BadChanges };
  }

  return { check: RevisionCheck.Valid, input: { summary, changes: changes.map(({ file, added, removed }) => ({ file, added, removed })) } };
}

export function readVerdictInput(raw: unknown): VerdictInput | null {
  const body = (raw ?? {}) as Record<string, unknown>;
  if (typeof body.verdict !== 'string' || !VERDICTS.includes(body.verdict)) {
    return null;
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, NOTE_MAX_CHARS) : '';

  return { verdict: body.verdict as Verdict, note: note || null };
}

function toVerdict(row: VerdictRow): VerdictEntry {
  return { reviewerId: row.reviewer_id, reviewerName: row.reviewer_name, verdict: row.verdict, note: row.note, decidedAt: row.decided_at };
}

function toRevision(row: RevisionRow, verdicts: VerdictEntry[]): Revision {
  return {
    id: row.id,
    sessionId: row.session_id,
    number: row.number,
    authorId: row.author_id,
    summary: row.summary,
    changes: row.changes,
    createdAt: row.created_at,
    verdicts,
    status: statusOf(verdicts.map((entry) => entry.verdict))
  };
}

export async function listRevisions(db: SupabaseClient, sessionId: string): Promise<Revision[]> {
  const revisions = await db.from('share_revisions').select('*').eq('session_id', sessionId).order('number', { ascending: true });
  if (revisions.error) {
    throw failure(revisions.error);
  }

  const verdicts = await db.from('share_verdicts').select('*').eq('session_id', sessionId).order('decided_at', { ascending: true });
  if (verdicts.error) {
    throw failure(verdicts.error);
  }

  const entries = (verdicts.data ?? []) as VerdictRow[];

  return ((revisions.data ?? []) as RevisionRow[]).map((row) => toRevision(row, entries.filter((entry) => entry.revision_id === row.id).map(toVerdict)));
}

export async function addRevision(db: SupabaseClient, session: SessionRow, author: { id: string; name: string }, input: RevisionInput): Promise<Revision> {
  const latest = await db.from('share_revisions').select('number').eq('session_id', session.id).order('number', { ascending: false }).limit(1).maybeSingle();
  const number = ((latest.data as { number: number } | null)?.number ?? NO_REVISIONS) + 1;

  const { data, error } = await db
    .from('share_revisions')
    .insert({ session_id: session.id, org_id: session.org_id, number, author_id: author.id, summary: input.summary, changes: input.changes })
    .select('*')
    .single();
  if (error || !data) {
    throw failure(error ?? { message: 'revision not created' });
  }

  return toRevision(data as RevisionRow, []);
}

export async function setVerdict(
  db: SupabaseClient,
  session: SessionRow,
  revisionId: string,
  reviewer: { id: string; name: string; role: SessionRole },
  input: VerdictInput,
  now: Date = new Date()
): Promise<VerdictOutcome> {
  const { data } = await db.from('share_revisions').select('id').eq('id', revisionId).eq('session_id', session.id).maybeSingle();
  if (!data) {
    return VerdictOutcome.NotFound;
  }
  if (reviewer.id === session.host_user_id) {
    return VerdictOutcome.OwnRevision;
  }

  const { error } = await db.from('share_verdicts').upsert(
    {
      revision_id: revisionId,
      session_id: session.id,
      org_id: session.org_id,
      reviewer_id: reviewer.id,
      reviewer_name: reviewer.name,
      verdict: input.verdict,
      note: input.note,
      decided_at: now.toISOString()
    },
    { onConflict: 'revision_id,reviewer_id' }
  );
  if (error) {
    throw failure(error);
  }

  return VerdictOutcome.Set;
}

export async function reviewOf(db: SupabaseClient, sessionId: string): Promise<Review> {
  const revisions = await listRevisions(db, sessionId);
  const revision = revisions.at(-1) ?? null;

  return { status: revision?.status ?? ReviewStatus.Open, revision, openComments: await listComments(db, sessionId, true) };
}

export async function revisionIn(db: SupabaseClient, sessionId: string, revisionId: string): Promise<boolean> {
  const { data } = await db.from('share_revisions').select('id').eq('id', revisionId).eq('session_id', sessionId).maybeSingle();

  return Boolean(data);
}
