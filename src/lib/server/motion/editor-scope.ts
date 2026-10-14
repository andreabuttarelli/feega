import { error, redirect } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser, type OpenCanvas } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';
import type { Db } from '$lib/server/db/client';
import { findMotionNode } from './editor';

type Params = { projectId: string; canvasId: string; nodeId: string };
type CanvasScope = { db: Db; userId: string; found: OpenCanvas };
type FoundMotion = Awaited<ReturnType<typeof findMotionNode>>;

export async function canvasScope(locals: App.Locals, params: Params): Promise<CanvasScope> {
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
  if (!found || found.canvas.projectId !== params.projectId) {
    throw error(404, 'This canvas does not exist, or is not yours');
  }
  return { db, userId: user.id, found };
}

export function nodeLookup(scope: CanvasScope, nodeId: string): Promise<[boolean, FoundMotion]> {
  return Promise.all([
    canvasReachable(scope.db, scope.found, scope.userId),
    findMotionNode(scope.db, { orgId: scope.found.orgId, nodeId, place: { canvasId: scope.found.canvas.id } })
  ]);
}

export function motionOrThrow({ db, userId, found }: CanvasScope, [reachable, motion]: [boolean, FoundMotion]) {
  if (!reachable) {
    throw error(404, 'This canvas does not exist, or is not yours');
  }
  if (!motion) {
    throw error(404, 'This frame does not exist');
  }
  return { db, userId, orgId: found.orgId, canvas: found.canvas, mode: found.mode, projectBrandId: found.projectBrandId, motion };
}

export async function motionScope(locals: App.Locals, params: Params) {
  const scope = await canvasScope(locals, params);
  return motionOrThrow(scope, await nodeLookup(scope, params.nodeId));
}
