import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findBrand } from '$lib/server/repos/brands';
import { findCampaign, isApprovable, listAdAccounts, listCampaigns, setCampaignStatus } from '$lib/server/repos/ads';
import { launchCampaign, setCampaignRunning, syncMetaAdAccounts } from '$lib/server/ads/paid-ads';
import { orgCreditBalance } from '$lib/server/credits';
import { providerMediaSigner } from '$lib/server/ads/provider-media';
import { projectScope } from '$lib/server/projects/request-scope';
import { buildAdsPageState } from './ads-page-load';

const RUNNING_ACTIONS = { pause: 'paused', resume: 'active' } as const;

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const scope = await projectScope(locals, params.projectId);
  const brandId = scope.project.brandId;

  const syncResult =
    brandId && url.searchParams.get('connected') === '1'
      ? await syncMetaAdAccounts(scope.db, { orgId: scope.orgId, brandId })
      : null;

  const state = await buildAdsPageState(
    { findBrand, listAdAccounts, listCampaigns },
    { orgId: scope.orgId, brandId, db: scope.db }
  );

  return { state, syncResult };
};

function campaignIdOf(fd: FormData): string {
  return String(fd.get('campaign_id') ?? '');
}

async function running(locals: App.Locals, projectId: string, request: Request, next: 'active' | 'paused') {
  const scope = await projectScope(locals, projectId);
  const result = await setCampaignRunning(scope.db, {
    orgId: scope.orgId,
    campaignId: campaignIdOf(await request.formData()),
    next
  });
  return result.ok ? { updated: next } : fail(422, result);
}

export const actions: Actions = {
  launch: async ({ params, request, locals }) => {
    const scope = await projectScope(locals, params.projectId);
    const result = await launchCampaign(
      scope.db,
      { creditBalance: (orgId) => orgCreditBalance(scope.db, orgId), publicUrls: providerMediaSigner(scope.db) },
      { orgId: scope.orgId, campaignId: campaignIdOf(await request.formData()), userId: scope.userId }
    );
    return result.ok ? { launched: result.campaign.id } : fail(422, result);
  },

  pause: ({ params, request, locals }) => running(locals, params.projectId, request, RUNNING_ACTIONS.pause),

  resume: ({ params, request, locals }) => running(locals, params.projectId, request, RUNNING_ACTIONS.resume),

  reject: async ({ params, request, locals }) => {
    const scope = await projectScope(locals, params.projectId);
    const campaignId = campaignIdOf(await request.formData());
    const campaign = await findCampaign(scope.db, { orgId: scope.orgId, campaignId });
    if (!campaign || !isApprovable(campaign)) {
      return fail(422, { ok: false, error: 'campaign_not_approvable' });
    }
    await setCampaignStatus(scope.db, { orgId: scope.orgId, campaignId, status: 'rejected' });
    return { rejected: campaignId };
  }
};
