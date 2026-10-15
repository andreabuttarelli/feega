import { json } from '@sveltejs/kit';
import { resolveOrgCaller, type OrgCaller } from '$lib/server/org-data/auth';
import { hiddenFor, type HiddenScope } from '$lib/server/uncensored-workspace/hidden-scope';
import { runsByIds } from '$lib/server/repos/node-runs';
import { findAssets } from '$lib/server/repos/assets';

export type Reach = { nodes?: string[]; runs?: string[]; assets?: string[]; project?: string | null };

const HTTP_NOT_FOUND = 404;

export const OUT_OF_REACH = 'not_found';

const outOfReach = () => json({ error: OUT_OF_REACH }, { status: HTTP_NOT_FOUND });

function hasHidden(hidden: HiddenScope): boolean {
  return hidden.projectIds.length > 0;
}

async function touchesHidden(caller: OrgCaller, reach: Reach, hidden: HiddenScope): Promise<boolean> {
  const nodes = new Set(hidden.nodeIds);
  const projects = new Set(hidden.projectIds);
  if (reach.project && projects.has(reach.project)) {
    return true;
  }
  if ((reach.nodes ?? []).some((id) => nodes.has(id))) {
    return true;
  }

  const [runs, assets] = await Promise.all([
    runsByIds(caller.db, { ids: reach.runs ?? [] }),
    findAssets(caller.db, { orgId: caller.orgId, assetIds: reach.assets ?? [] })
  ]);
  return runs.some((run) => nodes.has(run.nodeId)) || [...assets.values()].some((asset) => projects.has(asset.projectId ?? ''));
}

export async function callerReach(caller: OrgCaller, reach: Reach): Promise<Response | null> {
  const hidden = await hiddenFor(caller.db, { orgId: caller.orgId, userId: caller.userId });
  if (!hasHidden(hidden)) {
    return null;
  }
  return (await touchesHidden(caller, reach, hidden)) ? outOfReach() : null;
}

export async function reachableCaller(request: Request, url: URL, reach: Reach): Promise<OrgCaller | Response> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return json(resolved.error.body, { status: resolved.error.status });
  }
  return (await callerReach(resolved.caller, reach)) ?? resolved.caller;
}

export async function callerHidden(caller: OrgCaller): Promise<Set<string>> {
  return new Set((await hiddenFor(caller.db, { orgId: caller.orgId, userId: caller.userId })).projectIds);
}
