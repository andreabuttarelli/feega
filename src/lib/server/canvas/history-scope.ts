import { error } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { listMemberships } from '$lib/server/repos/orgs';
import { findCanvasForUser } from '$lib/server/canvas/lookup';
import { canvasReachable } from '$lib/server/uncensored-workspace/workspace-server';

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

type Locals = { safeGetSession: () => Promise<{ user: { id: string } | null }>; db: () => Promise<Db | null> };

export type HistoryScope = { db: Db; orgId: string; canvasId: string; userId: string };

export async function historyScope(locals: Locals, params: { projectId: string; canvasId: string }): Promise<HistoryScope> {
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    throw error(HTTP_UNAUTHORIZED, 'Sign in first');
  }

  const found = await findCanvasForUser(db, { canvasId: params.canvasId, memberships: await listMemberships(db, user.id) });
  if (!found || found.canvas.projectId !== params.projectId || !(await canvasReachable(db, found, user.id))) {
    throw error(HTTP_NOT_FOUND, 'This canvas does not exist, or is not yours');
  }
  return { db, orgId: found.orgId, canvasId: params.canvasId, userId: user.id };
}
