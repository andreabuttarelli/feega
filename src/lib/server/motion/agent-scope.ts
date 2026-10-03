import { json } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findReachableProject } from '$lib/server/projects/lookup';
import { findMotionNode } from '$lib/server/motion/editor';

export async function motionAgentScope(locals: App.Locals, params: { projectId?: string; nodeId?: string }) {
  const { session, user } = await locals.safeGetSession();
  if (!session?.access_token || !user) {
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
  const motion = await findMotionNode(db, { orgId: found.orgId, nodeId: params.nodeId ?? '', place: { projectId: found.project.id } });
  if (!motion) {
    return json({ error: 'node_not_found' }, { status: 404 });
  }
  return { db, user, orgId: found.orgId, project: found.project, motion } as const;
}
