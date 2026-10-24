import { json, type RequestEvent } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { listPromptSkills, writePromptSkill } from '$lib/server/repos/prompt-skills';
import { Outcome } from '$lib/server/repos/effects';
import { refused } from '$lib/server/effects/http';
import type { RequestHandler } from './$types';
import type { Db } from '$lib/server/db/client';

const CREATED = 201;

type Scope = { db: Db; orgId: string; userId: string } | { response: Response };

async function reachable(event: Pick<RequestEvent, 'locals'> & { params: { projectId?: string } }): Promise<Scope> {
  const { user } = await event.locals.safeGetSession();
  if (!user) {
    return { response: json({ error: 'unauthenticated' }, { status: 401 }) };
  }

  const db = await event.locals.db();
  if (!db) {
    return { response: json({ error: 'no_client' }, { status: 500 }) };
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: event.params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return { response: json({ error: 'project_not_found' }, { status: 404 }) };
  }

  return { db: db as Db, orgId: found.orgId, userId: user.id };
}

export const GET: RequestHandler = async (event) => {
  const scope = await reachable(event);
  if ('response' in scope) {
    return scope.response;
  }

  const skills = await listPromptSkills(scope.db, scope.orgId);
  return json({ skills: skills ?? [], available: skills !== null });
};

export const POST: RequestHandler = async (event) => {
  const scope = await reachable(event);
  if ('response' in scope) {
    return scope.response;
  }

  const input = await event.request.json().catch(() => null);
  const written = await writePromptSkill(scope.db, scope.orgId, { kind: 'user', id: scope.userId }, input);
  return written.outcome === Outcome.Ok ? json({ skill: written.skill }, { status: CREATED }) : refused(written.outcome, written.problems);
};
