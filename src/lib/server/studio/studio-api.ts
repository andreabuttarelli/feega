import { json } from '@sveltejs/kit';
import { resolveOrgCaller, type OrgCaller } from '$lib/server/org-data/auth';
import { listProjects } from '$lib/server/repos/projects';
import { findBatch } from '$lib/server/repos/product-batches';
import { PROJECT_PARAM, type ToolScope } from '$lib/server/dashboard/tool-scope';
import { ProjectMode } from '$lib/project-mode';
import { studioOptions } from './studio-options';
import { quoteSelection, selectionSchema, type Quote, type Selection } from './studio-batch';
import type { BatchScope } from './studio-actions';

export const HTTP_BAD_REQUEST = 400;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_CONFLICT = 409;
export const HTTP_UNPROCESSABLE = 422;

const ORG_PARAM = 'org';

export async function callerOf(request: Request, url: URL): Promise<OrgCaller | Response> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get(ORG_PARAM) ?? undefined);
  return 'error' in resolved ? json(resolved.error.body, { status: resolved.error.status }) : resolved.caller;
}

export const readOnly = () => json({ error: 'read_only_key' }, { status: HTTP_FORBIDDEN });

export const notFound = () => json({ error: 'not_found' }, { status: HTTP_NOT_FOUND });

async function projectScope(caller: OrgCaller, url: URL): Promise<ToolScope | null> {
  const projects = await listProjects(caller.db, caller.orgId);
  const chosen = url.searchParams.get(PROJECT_PARAM);
  const project = chosen ? projects.find((p) => p.id === chosen) : projects.find((p) => p.mode === ProjectMode.Standard);
  return project ? { db: caller.db, orgId: caller.orgId, projectId: project.id, userId: caller.userId } : null;
}

export async function batchScopeOf(caller: OrgCaller, batchId: string): Promise<BatchScope | null> {
  const batch = await findBatch(caller.db, { orgId: caller.orgId, batchId });
  return batch ? { db: caller.db, orgId: caller.orgId, projectId: batch.projectId, userId: caller.userId, batch } : null;
}

export type StudioRequest = { caller: OrgCaller; scope: ToolScope; selection: Selection; quote: Quote; body: Record<string, unknown> };

export async function studioRequest(request: Request, url: URL): Promise<StudioRequest | Response> {
  const caller = await callerOf(request, url);
  if (caller instanceof Response) {
    return caller;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = selectionSchema.safeParse(body?.selection);
  if (!body || !parsed.success) {
    return json({ error: 'invalid_selection' }, { status: HTTP_BAD_REQUEST });
  }

  const scope = await projectScope(caller, url);
  if (!scope) {
    return notFound();
  }

  const quote = quoteSelection(parsed.data, await studioOptions(scope.db, scope));
  if ('error' in quote) {
    return json({ error: quote.error }, { status: HTTP_UNPROCESSABLE });
  }
  return { caller, scope, selection: parsed.data, quote, body };
}
