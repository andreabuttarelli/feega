import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { listCampaigns, type CampaignStatus } from '$lib/server/repos/ads';
import { agentActor } from '$lib/server/repos/actor';
import { proposePaidAd } from '$lib/server/ads/paid-ads';
import { parsePaidAdJson } from '$lib/ads/paid-ad-form';

const UNPROCESSABLE = 422;

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const brandId = url.searchParams.get('brand_id');
  if (!brandId) return json({ error: 'brand_id_required' }, { status: 400 });

  const { db, orgId } = resolved.caller;
  const status = url.searchParams.get('status') as CampaignStatus | null;
  const campaigns = await listCampaigns(db, { orgId, brandId, status: status ?? undefined });

  return json({ campaigns });
};

export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const { db, orgId, userId, apiKeyId, writeAllowed } = resolved.caller;
  if (!writeAllowed) return json({ error: 'api_key_read_only' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const actor = apiKeyId ? agentActor(userId, `api_key:${apiKeyId}`) : { kind: 'user' as const, id: userId };
  const result = await proposePaidAd(db, { orgId, actor, draft: parsePaidAdJson(body) });
  if (!result.ok) return json(result, { status: UNPROCESSABLE });

  return json({
    campaign: result.campaign,
    note: 'Proposed as draft. Nothing spends until a person approves it (POST .../approve).'
  });
};
