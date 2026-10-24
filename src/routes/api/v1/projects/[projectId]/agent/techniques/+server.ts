import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { listTechniques } from '$lib/server/repos/techniques';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }

  const db = await locals.db();
  if (!db) {
    return json({ error: 'no_client' }, { status: 500 });
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findReachableProject(db, { projectId: params.projectId ?? '', memberships, userId: user.id });
  if (!found) {
    return json({ error: 'project_not_found' }, { status: 404 });
  }

  const techniques = await listTechniques(db, found.orgId);
  return json({ techniques: (techniques ?? []).map((t) => ({ id: t.id, name: t.name, nodes: t.plan.nodes.length })), available: techniques !== null });
};
