import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import { reasonOf, ReportReason, validateFields, validateReport, COUNTER_NOTICE_FIELDS, type ReportDetails } from '$lib/reports/reasons';
import {
  AccountAction,
  ContentAction,
  Decision,
  DECISION_EFFECTS,
  decisionOf,
  groundOf,
  ReportStatus,
  StrikeAction
} from '$lib/reports/decisions';
import { Standing, standingFor, strikeWeight, SUSPENSION_DAYS } from '$lib/reports/strikes';
import { addBusinessDays } from '$lib/reports/business-days';
import {
  counterForwardEmail,
  decisionEmail,
  escalationEmail,
  receiptEmail,
  statementOfReasons,
  type Mail,
  type ReportMailView
} from './report-emails';

export const REPORTS_PER_HOUR = 5;
export const COUNTER_NOTICE_BUSINESS_DAYS = 10;
const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;
const TERMINATION_HOURS = 876_000;
const OWNER_ROLE = 'owner';
const QUEUE_LIMIT = 200;

export type Outbox = (to: string, mail: Mail) => Promise<void>;
export type BanHours = number | null;
export type Banner = (userId: string, hours: BanHours) => Promise<void>;

export type ReportDeps = {
  db: Db;
  send: Outbox;
  ban: Banner;
  now: () => Date;
  internalRecipients: () => string[];
  origin: string;
};

export type ReportTarget = { shareToken?: string | null; canvasId?: string | null; nodeId?: string | null };

export type SubmitInput = {
  reason: string;
  form: Record<string, string | undefined>;
  target: ReportTarget;
  reporterUserId: string | null;
  fingerprint: string;
};

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'invalid'; errors: Record<string, string> }
  | { ok: false; kind: 'rate_limited' };

type ReportRow = {
  id: string;
  org_id: string | null;
  canvas_id: string | null;
  node_id: string | null;
  target_url: string;
  affected_user_id: string | null;
  reason: string;
  details: unknown;
  reporter_email: string | null;
  status: string;
  removed_share_token: string | null;
  counter_token_hash: string | null;
  restore_after: string | null;
  suit_filed_at: string | null;
};

const REPORT_COLUMNS =
  'id, org_id, canvas_id, node_id, target_url, affected_user_id, reason, details, reporter_email, status, removed_share_token, counter_token_hash, restore_after, suit_filed_at';

const BAN_FOR: Record<Standing, BanHours> = {
  [Standing.Good]: null,
  [Standing.Warned]: null,
  [Standing.Suspended]: SUSPENSION_DAYS * DAY_HOURS,
  [Standing.Terminated]: TERMINATION_HOURS
};

const STANDING_RANK: readonly Standing[] = [Standing.Good, Standing.Warned, Standing.Suspended, Standing.Terminated];

const atLeast = (a: Standing, b: Standing): Standing => (STANDING_RANK.indexOf(a) >= STANDING_RANK.indexOf(b) ? a : b);

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export function fingerprintOf(ip: string, salt: string): string {
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex').slice(0, 32);
}

const mailView = (row: ReportRow): ReportMailView => ({
  id: row.id,
  reason: row.reason as ReportReason,
  targetUrl: row.target_url,
  details: (row.details ?? {}) as ReportDetails
});

async function overRateLimit(deps: ReportDeps, fingerprint: string): Promise<boolean> {
  const since = new Date(deps.now().getTime() - HOUR_MS).toISOString();
  const { data, error } = await deps.db
    .from('content_reports')
    .select('id')
    .eq('reporter_fingerprint', fingerprint)
    .gt('created_at', since)
    .limit(REPORTS_PER_HOUR);
  if (error) {
    throw error;
  }
  return (data ?? []).length >= REPORTS_PER_HOUR;
}

type Resolved = { orgId: string | null; canvasId: string | null; nodeId: string | null; affectedUserId: string | null };

async function canvasOf(db: Db, target: ReportTarget): Promise<{ id: string; org_id: string } | null> {
  if (target.shareToken) {
    const { data } = await db.from('canvases').select('id, org_id').eq('share_token', target.shareToken).maybeSingle();
    return data;
  }
  if (target.canvasId) {
    const { data } = await db.from('canvases').select('id, org_id').eq('id', target.canvasId).maybeSingle();
    return data;
  }
  return null;
}

async function nodeOf(db: Db, nodeId: string | null | undefined) {
  if (!nodeId) {
    return null;
  }
  const { data } = await db.from('nodes').select('id, org_id, canvas_id, actor_id').eq('id', nodeId).maybeSingle();
  return data;
}

async function ownerOf(db: Db, orgId: string | null): Promise<string | null> {
  if (!orgId) {
    return null;
  }
  const { data } = await db.from('orgs_members').select('user_id').eq('org_id', orgId).eq('role', OWNER_ROLE).limit(1).maybeSingle();
  return data?.user_id ?? null;
}

async function resolveTarget(db: Db, target: ReportTarget): Promise<Resolved> {
  const canvas = await canvasOf(db, target);
  const found = await nodeOf(db, target.nodeId);
  const node = found && (!canvas || found.canvas_id === canvas.id) ? found : null;
  const orgId = node?.org_id ?? canvas?.org_id ?? null;

  return {
    orgId,
    canvasId: canvas?.id ?? node?.canvas_id ?? null,
    nodeId: node?.id ?? null,
    affectedUserId: node?.actor_id ?? (await ownerOf(db, orgId))
  };
}

async function notify(send: Outbox, to: string | null | undefined, mail: Mail): Promise<void> {
  if (!to) {
    return;
  }
  await send(to, mail).catch((e) => console.error('[reports] email failed', e));
}

export async function submitReport(deps: ReportDeps, input: SubmitInput): Promise<SubmitResult> {
  const validation = validateReport(input.reason, input.form);
  if (!validation.ok) {
    return { ok: false, kind: 'invalid', errors: validation.errors };
  }
  if (await overRateLimit(deps, input.fingerprint)) {
    return { ok: false, kind: 'rate_limited' };
  }

  const reason = reasonOf(input.reason)!;
  const details = validation.value;
  const resolved = await resolveTarget(deps.db, input.target);
  const escalate = reason.escalates(details);
  const now = deps.now().toISOString();

  const { data, error } = await deps.db
    .from('content_reports')
    .insert({
      org_id: resolved.orgId,
      canvas_id: resolved.canvasId,
      node_id: resolved.nodeId,
      share_token: input.target.shareToken ?? null,
      target_url: details.url,
      affected_user_id: resolved.affectedUserId,
      reason: reason.id,
      priority: reason.priority,
      details,
      reporter_name: details.name ?? null,
      reporter_email: details.email ?? null,
      reporter_user_id: input.reporterUserId,
      reporter_fingerprint: input.fingerprint,
      escalated_at: escalate ? now : null
    })
    .select('id')
    .single();
  if (error || !data) {
    throw error ?? new Error('report not saved');
  }

  const view: ReportMailView = { id: data.id, reason: reason.id, targetUrl: details.url, details };
  await notify(deps.send, details.email, receiptEmail(view));

  if (escalate) {
    const mail = escalationEmail(view, `${deps.origin}/admin/reports`);
    await Promise.all(deps.internalRecipients().map((to) => notify(deps.send, to, mail)));
  }

  return { ok: true, id: data.id };
}

async function loadReport(db: Db, id: string): Promise<ReportRow | null> {
  const { data } = await db.from('content_reports').select(REPORT_COLUMNS).eq('id', id).maybeSingle();
  return data as ReportRow | null;
}

async function removeContent(deps: ReportDeps, row: ReportRow): Promise<string | null> {
  const at = deps.now().toISOString();

  if (row.node_id) {
    await deps.db.from('nodes').update({ deleted_at: at, public_token_hash: null, public_expires_at: null }).eq('id', row.node_id);
  }
  if (!row.canvas_id) {
    return null;
  }

  const { data } = await deps.db.from('canvases').select('share_token').eq('id', row.canvas_id).maybeSingle();
  await deps.db.from('canvases').update({ share_token: null, shared_at: null }).eq('id', row.canvas_id);
  return data?.share_token ?? row.removed_share_token;
}

async function restoreContent(deps: ReportDeps, row: ReportRow): Promise<string | null> {
  if (row.node_id) {
    await deps.db.from('nodes').update({ deleted_at: null }).eq('id', row.node_id);
  }
  if (row.canvas_id && row.removed_share_token) {
    await deps.db
      .from('canvases')
      .update({ share_token: row.removed_share_token, shared_at: deps.now().toISOString() })
      .eq('id', row.canvas_id)
      .is('share_token', null);
  }
  return null;
}

const CONTENT_EFFECT: Record<ContentAction, (deps: ReportDeps, row: ReportRow) => Promise<string | null>> = {
  [ContentAction.Keep]: async (_deps, row) => row.removed_share_token,
  [ContentAction.Remove]: removeContent,
  [ContentAction.Restore]: restoreContent
};

async function addStrike(deps: ReportDeps, row: ReportRow): Promise<void> {
  await deps.db.from('account_strikes').insert({
    user_id: row.affected_user_id!,
    org_id: row.org_id,
    report_id: row.id,
    reason: row.reason,
    weight: strikeWeight(row.reason as ReportReason)
  });
}

async function revokeStrikes(deps: ReportDeps, row: ReportRow): Promise<void> {
  await deps.db.from('account_strikes').update({ revoked_at: deps.now().toISOString() }).eq('report_id', row.id);
}

const STRIKE_EFFECT: Record<StrikeAction, (deps: ReportDeps, row: ReportRow) => Promise<void>> = {
  [StrikeAction.None]: async () => {},
  [StrikeAction.Add]: addStrike,
  [StrikeAction.Revoke]: revokeStrikes
};

async function standingOf(db: Db, userId: string | null): Promise<Standing> {
  if (!userId) {
    return Standing.Good;
  }
  const { data } = await db.from('account_strikes').select('weight').eq('user_id', userId).is('revoked_at', null);
  const total = (data ?? []).reduce((sum, s) => sum + Number(s.weight), 0);
  return standingFor(total);
}

async function profileEmail(db: Db, userId: string | null): Promise<string | null> {
  if (!userId) {
    return null;
  }
  const { data } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  return data?.email ?? null;
}

export type DecideInput = { reportId: string; decision: string; ground: string; note: string; decidedBy: string | null };
export type DecideResult = { ok: true; standing: Standing } | { ok: false; error: string };

const DMCA_REMOVALS: ReadonlySet<Decision> = new Set([Decision.Remove, Decision.Suspend]);

export async function decideReport(deps: ReportDeps, input: DecideInput): Promise<DecideResult> {
  const decision = decisionOf(input.decision);
  const ground = decision ? groundOf(decision, input.ground) : null;
  const note = input.note.trim();
  if (!decision || !ground) {
    return { ok: false, error: 'Choose a decision and a ground that justifies it' };
  }
  if (!note) {
    return { ok: false, error: 'Explain the facts behind the decision' };
  }

  const row = await loadReport(deps.db, input.reportId);
  if (!row) {
    return { ok: false, error: 'Report not found' };
  }

  const effect = DECISION_EFFECTS[decision];
  const removedShareToken = await CONTENT_EFFECT[effect.content](deps, row);
  if (row.affected_user_id) {
    await STRIKE_EFFECT[effect.strike](deps, row);
  }

  const byStrikes = await standingOf(deps.db, row.affected_user_id);
  const standing = effect.account === AccountAction.Suspend ? atLeast(byStrikes, Standing.Suspended) : byStrikes;
  if (row.affected_user_id && effect.strike !== StrikeAction.None) {
    await deps.ban(row.affected_user_id, BAN_FOR[standing]);
  }

  const counterToken = row.reason === ReportReason.Copyright && DMCA_REMOVALS.has(decision) ? randomBytes(24).toString('base64url') : null;
  const { error } = await deps.db
    .from('content_reports')
    .update({
      status: effect.status,
      decision,
      ground: ground.id,
      decision_note: note,
      automated: false,
      decided_by: input.decidedBy,
      decided_at: deps.now().toISOString(),
      removed_share_token: removedShareToken,
      counter_token_hash: counterToken ? hashToken(counterToken) : row.counter_token_hash,
      updated_at: deps.now().toISOString()
    })
    .eq('id', row.id);
  if (error) {
    throw error;
  }

  const view = mailView(row);
  const decisionView = { decision, ground, note, standing };
  const counterUrl = counterToken ? `${deps.origin}/report/counter/${row.id}?t=${counterToken}` : null;

  await notify(deps.send, row.reporter_email, decisionEmail(view, decisionView));
  if (effect.content !== ContentAction.Keep) {
    await notify(deps.send, await profileEmail(deps.db, row.affected_user_id), statementOfReasons(view, decisionView, counterUrl));
  }

  return { ok: true, standing };
}

export type CounterResult = { ok: true; restoreAfter: Date } | { ok: false; errors: Record<string, string> };

const COUNTERABLE: ReadonlySet<string> = new Set([ReportStatus.Actioned]);

export async function fileCounterNotice(
  deps: ReportDeps,
  input: { reportId: string; token: string; form: Record<string, string | undefined> }
): Promise<CounterResult> {
  const row = await loadReport(deps.db, input.reportId);
  const valid = row && row.counter_token_hash && row.counter_token_hash === hashToken(input.token) && COUNTERABLE.has(row.status);
  if (!row || !valid) {
    return { ok: false, errors: { form: 'This counter-notice link is not valid or was already used' } };
  }

  const validation = validateFields(COUNTER_NOTICE_FIELDS, input.form);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const now = deps.now();
  const restoreAfter = addBusinessDays(now, COUNTER_NOTICE_BUSINESS_DAYS);
  await deps.db
    .from('content_reports')
    .update({
      status: ReportStatus.CounterNoticed,
      counter_notice: validation.value,
      counter_noticed_at: now.toISOString(),
      restore_after: restoreAfter.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('id', row.id);

  const counter = { name: validation.value.name, address: validation.value.address, statement: validation.value.statement };
  await notify(deps.send, row.reporter_email, counterForwardEmail(mailView(row), counter, restoreAfter));

  return { ok: true, restoreAfter };
}

export async function markSuitFiled(deps: ReportDeps, reportId: string): Promise<void> {
  await deps.db.from('content_reports').update({ suit_filed_at: deps.now().toISOString() }).eq('id', reportId);
}

const RESTORE_NOTE = 'The uploader sent a valid counter-notice and the claimant did not report a court action within the statutory period.';

export async function restoreDueReports(deps: ReportDeps): Promise<{ restored: number }> {
  const { data } = await deps.db
    .from('content_reports')
    .select('id, restore_after, suit_filed_at')
    .eq('status', ReportStatus.CounterNoticed)
    .is('suit_filed_at', null)
    .lt('restore_after', deps.now().toISOString());

  let restored = 0;
  for (const row of data ?? []) {
    const result = await decideReport(deps, { reportId: row.id, decision: Decision.Restore, ground: 'counter_notice', note: RESTORE_NOTE, decidedBy: null });
    restored += result.ok ? 1 : 0;
  }
  return { restored };
}

export type QueueRow = {
  id: string;
  reason: string;
  priority: number;
  status: string;
  target_url: string;
  details: unknown;
  reporter_email: string | null;
  decision: string | null;
  ground: string | null;
  decision_note: string | null;
  escalated_at: string | null;
  restore_after: string | null;
  suit_filed_at: string | null;
  created_at: string;
};

export async function listQueue(db: Db): Promise<QueueRow[]> {
  const { data, error } = await db
    .from('content_reports')
    .select('id, reason, priority, status, target_url, details, reporter_email, decision, ground, decision_note, escalated_at, restore_after, suit_filed_at, created_at')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(QUEUE_LIMIT);
  if (error) {
    throw error;
  }
  const open = (r: QueueRow) => (r.status === ReportStatus.Open ? 0 : 1);
  return ((data ?? []) as QueueRow[]).sort((a, b) => open(a) - open(b));
}
