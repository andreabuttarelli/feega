import { error, type RequestEvent } from '@sveltejs/kit';
import { signedInDb } from './app-shell';
import { listMemberships, type Membership } from '$lib/server/repos/orgs';
import { listProjects } from '$lib/server/repos/projects';
import { findReachableProject } from '$lib/server/projects/lookup';
import { findBatch, type Batch } from '$lib/server/repos/product-batches';
import { chooseOrg, ORG_COOKIE } from '$lib/server/tenancy/context';
import { ProjectMode } from '$lib/project-mode';
import type { Db } from '$lib/server/db/client';
import type { StudioCtx } from '$lib/server/studio/studio-batch';

export type ToolScope = StudioCtx & { db: Db };

export const PROJECT_PARAM = 'project';

const HTTP_NOT_FOUND = 404;

type ScopeEvent = Pick<RequestEvent, 'locals' | 'url' | 'cookies' | 'params'>;

async function signedIn(event: ScopeEvent): Promise<{ db: Db; userId: string; memberships: Membership[] }> {
  const { db, user } = await signedInDb(event);
  return { db, userId: user.id, memberships: await listMemberships(db, user.id) };
}

async function recentProjectId(db: Db, memberships: Membership[], chosenOrgId: string | null): Promise<string> {
  const membership = chooseOrg(memberships, chosenOrgId);
  const projects = membership ? await listProjects(db, membership.org.id) : [];
  const recent = projects.find((p) => p.mode === ProjectMode.Standard);
  if (!recent) {
    throw error(HTTP_NOT_FOUND, 'Create a project first');
  }
  return recent.id;
}

export async function toolScope(event: ScopeEvent, chosenProjectId: string | null = null): Promise<ToolScope> {
  const { db, userId, memberships } = await signedIn(event);
  const projectId = chosenProjectId || event.url.searchParams.get(PROJECT_PARAM) || (await recentProjectId(db, memberships, event.cookies.get(ORG_COOKIE) ?? null));

  const found = await findReachableProject(db, { projectId, memberships, userId });
  if (!found) {
    throw error(HTTP_NOT_FOUND, 'This project does not exist, or is not yours');
  }

  return { db, orgId: found.orgId, projectId: found.project.id, userId };
}

export async function batchScope(event: ScopeEvent): Promise<ToolScope & { batch: Batch }> {
  const { db, userId, memberships } = await signedIn(event);
  const batchId = event.params.batchId ?? '';

  for (const { org } of memberships) {
    const batch = await findBatch(db, { orgId: org.id, batchId });
    if (batch) {
      return { db, orgId: org.id, projectId: batch.projectId, userId, batch };
    }
  }

  throw error(HTTP_NOT_FOUND, 'Batch not found');
}
