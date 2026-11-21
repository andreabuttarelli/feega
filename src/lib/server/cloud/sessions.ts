import type { SupabaseClient } from '@supabase/supabase-js';
import { newSid } from './sid';

export type VisitorRole = 'viewer' | 'editor';
export type SessionRole = 'host' | VisitorRole;

export type SessionRow = {
  id: string;
  org_id: string;
  project_id: string;
  host_user_id: string;
  project_name: string;
  visitor_role: VisitorRole;
  status: 'live' | 'closed';
  started_at: string;
  closed_at: string | null;
  expires_at: string;
  snapshot_path: string | null;
};

export type LiveSession = { row: SessionRow; hostName: string };

export enum Outcome {
  Done = 'done',
  NotHost = 'not_host',
  NotMember = 'not_member'
}

export const SNAPSHOT_BUCKET = 'share-snapshots';
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

const UNIQUE_VIOLATION = '23505';
const SID_ATTEMPTS = 5;
const UNKNOWN_HOST = 'Someone';

type Input = { orgId: string; hostId: string; projectName: string; visitorRole: VisitorRole; now: Date };

function failure(error: { message: string }): Error {
  return new Error(`cloud sessions: ${error.message}`);
}

async function projectIdOf(db: SupabaseClient, orgId: string, name: string): Promise<string> {
  const find = () => db.from('cloud_projects').select('id').eq('org_id', orgId).eq('name', name).maybeSingle();

  const existing = await find();
  if (existing.data) {
    return existing.data.id as string;
  }

  const created = await db.from('cloud_projects').insert({ org_id: orgId, name }).select('id').single();
  if (created.data) {
    return created.data.id as string;
  }
  if (created.error?.code !== UNIQUE_VIOLATION) {
    throw failure(created.error ?? { message: 'project not created' });
  }

  const raced = await find();
  if (!raced.data) {
    throw failure({ message: 'project vanished' });
  }

  return raced.data.id as string;
}

export async function startSession(db: SupabaseClient, input: Input): Promise<SessionRow> {
  const projectId = await projectIdOf(db, input.orgId, input.projectName);
  const expiresAt = new Date(input.now.getTime() + SESSION_MAX_MS).toISOString();

  for (let attempt = 0; attempt < SID_ATTEMPTS; attempt++) {
    const { data, error } = await db
      .from('share_sessions')
      .insert({
        id: newSid(),
        org_id: input.orgId,
        project_id: projectId,
        host_user_id: input.hostId,
        project_name: input.projectName,
        visitor_role: input.visitorRole,
        status: 'live',
        started_at: input.now.toISOString(),
        expires_at: expiresAt
      })
      .select('*')
      .single();

    if (data) {
      return data as SessionRow;
    }
    if (error?.code !== UNIQUE_VIOLATION) {
      throw failure(error ?? { message: 'session not created' });
    }
  }

  throw failure({ message: 'no free session id' });
}

export async function sessionFor(db: SupabaseClient, id: string, orgId: string): Promise<SessionRow | null> {
  const { data, error } = await db.from('share_sessions').select('*').eq('id', id).eq('org_id', orgId).maybeSingle();
  if (error) {
    throw failure(error);
  }

  return (data as SessionRow | null) ?? null;
}

export async function sessionById(db: SupabaseClient, id: string): Promise<SessionRow | null> {
  const { data, error } = await db.from('share_sessions').select('*').eq('id', id).maybeSingle();
  if (error) {
    throw failure(error);
  }

  return (data as SessionRow | null) ?? null;
}

export async function liveSessions(db: SupabaseClient, orgId: string, now: Date): Promise<LiveSession[]> {
  const { data, error } = await db
    .from('share_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'live')
    .gte('expires_at', now.toISOString())
    .order('started_at', { ascending: false });
  if (error) {
    throw failure(error);
  }

  const rows = (data ?? []) as SessionRow[];
  const names = await namesOf(db, [...new Set(rows.map((row) => row.host_user_id))]);

  return rows.map((row) => ({ row, hostName: names.get(row.host_user_id) ?? UNKNOWN_HOST }));
}

export async function namesOf(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) {
    return new Map();
  }

  const { data } = await db.from('profiles').select('id, name, email').in('id', userIds);
  const people = (data ?? []) as { id: string; name: string | null; email: string | null }[];

  return new Map(people.map((person) => [person.id, person.name || person.email?.split('@')[0] || UNKNOWN_HOST]));
}

export async function roleIn(db: SupabaseClient, session: SessionRow, userId: string): Promise<SessionRole | null> {
  if (session.host_user_id === userId) {
    return 'host';
  }

  const { data } = await db.from('share_members').select('role, removed_at').eq('session_id', session.id).eq('user_id', userId).maybeSingle();
  const member = data as { role: VisitorRole; removed_at: string | null } | null;
  if (!member) {
    return session.visitor_role;
  }

  return member.removed_at ? null : member.role;
}

export async function joinSession(db: SupabaseClient, session: SessionRow, userId: string): Promise<void> {
  const { error } = await db
    .from('share_members')
    .upsert({ session_id: session.id, org_id: session.org_id, user_id: userId, role: session.visitor_role }, { ignoreDuplicates: true });
  if (error) {
    throw failure(error);
  }
}

export async function setMemberRole(db: SupabaseClient, session: SessionRow, hostId: string, targetId: string, role: VisitorRole): Promise<Outcome> {
  if (session.host_user_id !== hostId) {
    return Outcome.NotHost;
  }

  const { data: membership } = await db.from('orgs_members').select('user_id').eq('org_id', session.org_id).eq('user_id', targetId).maybeSingle();
  if (!membership) {
    return Outcome.NotMember;
  }

  const { data: existing } = await db.from('share_members').select('user_id').eq('session_id', session.id).eq('user_id', targetId).maybeSingle();
  const write = existing
    ? db.from('share_members').update({ role, removed_at: null }).eq('session_id', session.id).eq('user_id', targetId)
    : db.from('share_members').insert({ session_id: session.id, org_id: session.org_id, user_id: targetId, role });

  const { error } = await write;
  if (error) {
    throw failure(error);
  }

  return Outcome.Done;
}

export function snapshotPathOf(session: Pick<SessionRow, 'org_id' | 'id'>): string {
  return `${session.org_id}/${session.id}.zip`;
}

export async function closeSession(db: SupabaseClient, session: SessionRow, hostId: string, now: Date): Promise<{ outcome: Outcome.Done; uploadUrl: string } | { outcome: Outcome.NotHost }> {
  if (session.host_user_id !== hostId) {
    return { outcome: Outcome.NotHost };
  }

  const path = snapshotPathOf(session);
  const closedAt = session.closed_at ?? now.toISOString();
  const { error } = await db.from('share_sessions').update({ status: 'closed', closed_at: closedAt, snapshot_path: path }).eq('id', session.id);
  if (error) {
    throw failure(error);
  }

  const signed = await db.storage.from(SNAPSHOT_BUCKET).createSignedUploadUrl(path);
  if (!signed.data) {
    throw failure(signed.error ?? { message: 'upload url not issued' });
  }

  return { outcome: Outcome.Done, uploadUrl: signed.data.signedUrl };
}

const VERSION_NAME_MAX_CHARS = 80;
const VERSION_SUFFIX_CHARS = 6;
const EDIT_ROLES: readonly SessionRole[] = ['host', 'editor'];

export function versionPathOf(session: Pick<SessionRow, 'org_id' | 'id'>, versionId: string): string {
  return `${session.org_id}/${session.id}/versions/${versionId}.zip`;
}

export function versionIdFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, VERSION_NAME_MAX_CHARS) || 'version';

  return `${slug}-${newSid().slice(0, VERSION_SUFFIX_CHARS)}`;
}

export async function createVersion(
  db: SupabaseClient,
  session: SessionRow,
  role: SessionRole,
  name: string
): Promise<{ outcome: Outcome.Done; versionId: string; uploadUrl: string } | { outcome: Outcome.NotHost }> {
  if (!EDIT_ROLES.includes(role)) {
    return { outcome: Outcome.NotHost };
  }

  const versionId = versionIdFor(name);
  const signed = await db.storage.from(SNAPSHOT_BUCKET).createSignedUploadUrl(versionPathOf(session, versionId));
  if (!signed.data) {
    throw failure(signed.error ?? { message: 'upload url not issued' });
  }

  return { outcome: Outcome.Done, versionId, uploadUrl: signed.data.signedUrl };
}
