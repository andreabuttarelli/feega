import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listMemberships } from '$lib/server/repos/orgs';
import { findProjectForUser } from '$lib/server/projects/lookup';
import { listProjects } from '$lib/server/repos/projects';
import { uncensoredLockFor } from '$lib/server/uncensored-workspace/workspace-server';
import { openUncensoredProject, verifyUserAge } from '$lib/server/uncensored-workspace/workspace';
import { UNCENSORED_LOCK_TEXT, UncensoredLock, uncensoredSectionVisible } from '$lib/uncensored-lock';
import { ProjectMode } from '$lib/project-mode';

const HTTP_FORBIDDEN = 403;

async function scopeFor(event: RequestEvent) {
  const { session, user } = await event.locals.safeGetSession();
  if (!session || !user) {
    throw redirect(303, '/login');
  }

  const db = await event.locals.db();
  if (!db) {
    throw error(500, 'sessione senza client');
  }

  const memberships = await listMemberships(db, user.id);
  const found = await findProjectForUser(db, { projectId: event.params.projectId ?? '', memberships });
  if (!found) {
    throw error(404, 'This project does not exist, or is not yours');
  }

  return { db, orgId: found.orgId, userId: user.id };
}

export const load: PageServerLoad = async (event) => {
  const { db, orgId, userId } = await scopeFor(event);
  const lock = await uncensoredLockFor(db, { orgId, userId });
  if (!uncensoredSectionVisible(lock)) {
    throw error(404, 'Not found');
  }

  const projects = lock === UncensoredLock.Open ? (await listProjects(db, orgId)).filter((p) => p.mode === ProjectMode.Uncensored) : [];
  return {
    lock,
    text: UNCENSORED_LOCK_TEXT[lock],
    projects: projects.map((p) => ({ id: p.id, name: p.name, href: `/p/${p.id}` }))
  };
};

export const actions: Actions = {
  verify: async (event) => {
    const { db, orgId, userId } = await scopeFor(event);
    const out = await verifyUserAge(db, { orgId, userId });
    if (!out.ok) {
      return fail(HTTP_FORBIDDEN, { error: out.error });
    }
    return { verified: true };
  },

  create: async (event) => {
    const { db, orgId, userId } = await scopeFor(event);
    const name = String((await event.request.formData()).get('name') ?? '');
    const out = await openUncensoredProject(db, { orgId, userId, name });
    if (!out.ok) {
      return fail(HTTP_FORBIDDEN, { error: out.error });
    }
    throw redirect(303, `/p/${out.projectId}/c/${out.canvasId}`);
  }
};
