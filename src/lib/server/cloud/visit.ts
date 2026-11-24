import type { SupabaseClient } from '@supabase/supabase-js';
import { visitorAuthUrl } from './hosts';
import { listComments, type Comment } from './comments';
import { listRevisions, ReviewStatus, type Revision } from './revisions';
import { isSid } from './sid';
import { joinSession, namesOf, roleIn, sessionById, SESSION_MAX_MS, type SessionRow } from './sessions';
import { signToken } from './token';

export enum VisitKind {
  NotFound = 'not_found',
  Removed = 'removed',
  Enter = 'enter',
  Ended = 'ended'
}

export type Ended = {
  projectName: string;
  endedAt: string;
  snapshot: boolean;
  comments: Comment[];
  revisions: Revision[];
  status: ReviewStatus;
  mayDecide: boolean;
  hostOffline: boolean;
};

export type Visit =
  | { kind: VisitKind.NotFound }
  | { kind: VisitKind.Removed }
  | { kind: VisitKind.Enter; url: string }
  | { kind: VisitKind.Ended; ended: Ended };

const MS_PER_SECOND = 1000;
const DEFAULT_NEXT = '/';

export function safeVisitorPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_NEXT;
  }

  return value;
}

function isEnded(session: SessionRow, now: Date): boolean {
  return session.status === 'closed' || new Date(session.expires_at).getTime() <= now.getTime();
}

export async function visit(
  db: SupabaseClient,
  input: { sid: string; userId: string; next: string | null; secret: string; now: Date; hostOffline?: boolean }
): Promise<Visit> {
  const session = isSid(input.sid) ? await sessionById(db, input.sid) : null;
  if (!session) {
    return { kind: VisitKind.NotFound };
  }

  const role = await roleIn(db, session, input.userId);
  if (!role) {
    return { kind: VisitKind.Removed };
  }

  const hostOffline = !isEnded(session, input.now) && input.hostOffline === true;

  if (isEnded(session, input.now) || hostOffline) {
    const revisions = await listRevisions(db, session.id);

    return {
      kind: VisitKind.Ended,
      ended: {
        projectName: session.project_name,
        endedAt: session.closed_at ?? (hostOffline ? input.now.toISOString() : session.expires_at),
        snapshot: Boolean(session.snapshot_path),
        comments: await listComments(db, session.id, false),
        revisions,
        status: revisions.at(-1)?.status ?? ReviewStatus.Open,
        mayDecide: input.userId !== session.host_user_id,
        hostOffline
      }
    };
  }

  if (role !== 'host') {
    await joinSession(db, session, input.userId);
  }

  const visitorRole = role === 'host' ? 'editor' : role;
  const expiry = Math.min(input.now.getTime() + SESSION_MAX_MS, new Date(session.expires_at).getTime());
  const name = (await namesOf(db, [input.userId])).get(input.userId);
  const token = await signToken({ sid: session.id, role: visitorRole, sub: input.userId, org: session.org_id, exp: Math.floor(expiry / MS_PER_SECOND), name }, input.secret);

  return { kind: VisitKind.Enter, url: visitorAuthUrl(session.id, token, safeVisitorPath(input.next)) };
}
