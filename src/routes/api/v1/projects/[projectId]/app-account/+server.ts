import { json } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { appAccountStore, readAppAccount } from '$lib/server/repos/app-accounts';
import { callerOf } from '$lib/server/effects/http';
import type { RequestHandler } from './$types';

type Scope = { db: Db; orgId: string; projectId: string; userId: string };

type Event = { request: Request; url: URL; locals: App.Locals; params: { projectId?: string } };

async function scopeOf({ request, url, locals, params }: Event): Promise<Scope | Response> {
  const projectId = params.projectId ?? '';
  if (request.headers.has('authorization')) {
    const resolved = await callerOf(request, url);
    return 'response' in resolved ? resolved.response : { db: resolved.caller.db, orgId: resolved.caller.orgId, projectId, userId: resolved.caller.userId };
  }

  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }
  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: 500 });
  }
  const found = await findReachableProject(db, { projectId, memberships: await listMemberships(db, user.id), userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }
  return { db, orgId: found.orgId, projectId: found.project.id, userId: user.id };
}

export const GET: RequestHandler = async (event) => {
  const scope = await scopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  return json({ account: await readAppAccount(scope.db, scope) });
};

export const DELETE: RequestHandler = async (event) => {
  const scope = await scopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }
  await appAccountStore(scope.db, { ...scope, actor: { kind: 'user', id: scope.userId } }).forget();
  return json({ ok: true });
};
