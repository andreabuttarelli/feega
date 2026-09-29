import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { setCampaignRunning } from '$lib/server/ads/paid-ads';

const RUNNING_STATES = ['active', 'paused'] as const;
const UNPROCESSABLE = 422;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const { db, orgId, writeAllowed } = resolved.caller;
  if (!writeAllowed) return json({ error: 'api_key_read_only' }, { status: 403 });

  const { next } = (await request.json().catch(() => ({}))) as { next?: string };
  const running = RUNNING_STATES.find((s) => s === next);
  if (!running) return json({ error: 'next_must_be_active_or_paused' }, { status: 400 });

  const result = await setCampaignRunning(db, { orgId, campaignId: params.id ?? '', next: running });
  return result.ok ? json(result) : json(result, { status: UNPROCESSABLE });
};
