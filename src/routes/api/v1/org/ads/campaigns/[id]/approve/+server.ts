import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { launchCampaign } from '$lib/server/ads/paid-ads';
import { orgCreditBalance } from '$lib/server/credits';
import { providerMediaSigner } from '$lib/server/ads/provider-media';

const FAILURE_STATUS: Record<string, number> = {
  campaign_not_approvable: 404,
  credits_exhausted: 402
};
const UNPROCESSABLE = 422;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const { db, orgId, userId, apiKeyId } = resolved.caller;
  if (apiKeyId) {
    return json(
      { error: 'human_approval_required', message: 'A campaign cannot approve itself over an API key — sign in as a person to approve it.' },
      { status: 403 }
    );
  }

  const result = await launchCampaign(
    db,
    { creditBalance: (id) => orgCreditBalance(db, id), publicUrls: providerMediaSigner(db) },
    { orgId, campaignId: params.id ?? '', userId }
  );
  if (!result.ok) return json(result, { status: FAILURE_STATUS[result.error] ?? UNPROCESSABLE });

  return json({ campaign: result.campaign });
};
