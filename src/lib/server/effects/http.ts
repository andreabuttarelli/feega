import { json } from '@sveltejs/kit';
import { resolveOrgCaller, type OrgCaller } from '$lib/server/org-data/auth';
import { Outcome, type Written } from '$lib/server/repos/effects';
import { chromiumGl, serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { effectStore, type EffectStore } from './store';

const API_AGENT_KEY = 'api';

export function storeOf(caller: OrgCaller): EffectStore {
  const actor = caller.apiKeyId ? { kind: 'agent' as const, id: caller.userId, agentKey: API_AGENT_KEY } : { kind: 'user' as const, id: caller.userId };
  return effectStore({ db: caller.db, orgId: caller.orgId, actor, gl: serverFramesOpen() ? chromiumGl : null });
}

const STATUS: Record<Exclude<Outcome, Outcome.Ok>, number> = {
  [Outcome.Unavailable]: 503,
  [Outcome.NotFound]: 404,
  [Outcome.Conflict]: 409,
  [Outcome.Invalid]: 400,
  [Outcome.NameTaken]: 409
};

export async function callerOf(request: Request, url: URL): Promise<{ caller: OrgCaller } | { response: Response }> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) {
    return { response: json(resolved.error.body, { status: resolved.error.status }) };
  }

  return { caller: resolved.caller };
}

export const refused = (outcome: Exclude<Outcome, Outcome.Ok>, problems?: string[]) => json({ error: outcome, problems }, { status: STATUS[outcome] });

export const forbidden = () => json({ error: 'read_only_key' }, { status: 403 });

export function written(result: Written, okStatus: number): Response {
  if (result.outcome !== Outcome.Ok) {
    return refused(result.outcome, result.problems);
  }

  return json({ effect: result.effect }, { status: okStatus });
}

export async function bodyOf(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
