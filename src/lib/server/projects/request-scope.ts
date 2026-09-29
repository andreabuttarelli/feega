import { error, redirect } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import type { Project } from '$lib/server/repos/projects';
import { listMemberships } from '$lib/server/repos/orgs';
import { findProjectForUser } from './lookup';

export type ProjectScope = { db: Db; orgId: string; project: Project; userId: string };

export async function projectScope(locals: App.Locals, projectId: string): Promise<ProjectScope> {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findProjectForUser(db, { projectId, memberships });
  if (!found) {
    throw error(404, 'questo progetto non esiste, o non è tuo');
  }

  return { db, orgId: found.orgId, project: found.project, userId: user.id };
}
