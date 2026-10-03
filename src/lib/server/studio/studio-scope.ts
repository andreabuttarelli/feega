import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { listMemberships } from '$lib/server/repos/orgs';
import { findProjectForUser } from '$lib/server/projects/lookup';
import type { Db } from '$lib/server/db/client';
import type { StudioCtx } from './studio-batch';

export type StudioScope = StudioCtx & { db: Db };

export async function studioScope(event: Pick<RequestEvent, 'locals' | 'params'>): Promise<StudioScope> {
  const { session, user } = await event.locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await event.locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const memberships = await listMemberships(db, user.id);
  const params = event.params as Record<string, string | undefined>;
  const found = await findProjectForUser(db, { projectId: params.projectId ?? '', memberships });
  if (!found) {
    throw error(404, 'This project does not exist, or is not yours');
  }

  return { db, orgId: found.orgId, projectId: found.project.id, userId: user.id };
}
