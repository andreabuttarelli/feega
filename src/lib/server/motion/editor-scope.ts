import { error, redirect } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import { findMotionNode } from './editor';

export async function motionScope(locals: App.Locals, params: { projectId: string; canvasId: string; nodeId: string }) {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }
  const db = await locals.db();
  if (!db) {
    throw error(500, 'no client');
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(404, 'This canvas does not exist, or is not yours');
  }

  const motion = await findMotionNode(db, { orgId: found.orgId, nodeId: params.nodeId, place: { canvasId: found.canvas.id } });
  if (!motion) {
    throw error(404, 'This motion node does not exist');
  }
  return { db, userId: user.id, orgId: found.orgId, canvas: found.canvas, projectBrandId: found.projectBrandId, motion };
}
