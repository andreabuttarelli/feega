import { json, type RequestEvent } from '@sveltejs/kit';
import { bearerOf } from '$lib/server/api/bearer-page';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import type { Db } from '$lib/server/db/client';

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

export type ProjectScope = { db: Db; orgId: string; projectId: string };

async function callerOf(event: Pick<RequestEvent, 'request' | 'locals'>): Promise<{ db: Db; userId: string } | Response> {
  if (event.request.headers.has('authorization')) {
    const bearer = await bearerOf(event.request);
    return bearer instanceof Response ? bearer : { db: bearer.db, userId: bearer.user.id };
  }

  const { user } = await event.locals.safeGetSession();
  const db = user ? await event.locals.db() : null;
  if (!user || !db) {
    return json({ error: 'unauthenticated' }, { status: UNAUTHORIZED });
  }
  return { db: db as Db, userId: user.id };
}

export async function projectScope(event: Pick<RequestEvent, 'request' | 'locals'>, projectId: string): Promise<ProjectScope | Response> {
  const caller = await callerOf(event);
  if (caller instanceof Response) {
    return caller;
  }

  const found = await findReachableProject(caller.db, { projectId, memberships: await listMemberships(caller.db, caller.userId), userId: caller.userId });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: NOT_FOUND });
  }
  return { db: caller.db, orgId: found.orgId, projectId: found.project.id };
}
