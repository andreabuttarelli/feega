import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listNodesByIds } from '$lib/server/repos/canvas';
import {
  approveCampaign,
  createCampaign,
  createCreative,
  findAdAccount,
  findCampaign,
  findCreative,
  isApprovable,
  recordLaunch,
  saveMetaAdAccount,
  setCampaignStatus,
  type AdCampaign,
  type AdCreative,
  type AdTargeting,
  type CreativeMedia
} from '$lib/server/repos/ads';
import {
  boostPost,
  createStandaloneAd,
  listAdAccounts as listZernioAdAccounts,
  updateCampaignStatus,
  type AdGoal
} from '$lib/server/zernio-ads';
import { chargeAdsCredits } from '$lib/server/ads-credits';
import { creditsForSpend, normalizeUrl } from '$lib/ads-fee';
import {
  draftProblems,
  launchFee,
  placementsPayload,
  scheduleFor,
  zernioGenders,
  type DraftProblem,
  type PaidAdDraft
} from '$lib/ads/paid-ad';

const META_PUBLISHING_PLATFORM = 'facebook';
const ERROR_MAX_LENGTH = 500;

export type ProposeResult =
  | { ok: true; campaign: AdCampaign }
  | { ok: false; error: 'invalid_draft'; problems: DraftProblem[] }
  | { ok: false; error: 'ad_account_not_found' | 'media_not_found' };

function targetingOf(draft: PaidAdDraft): AdTargeting {
  const genders = zernioGenders(draft.gender);
  return {
    countries: draft.countries,
    age_min: draft.ageMin,
    age_max: draft.ageMax,
    ...(genders.length ? { genders } : {})
  };
}

async function mediaOf(db: Db, orgId: string, nodeIds: string[]): Promise<CreativeMedia[] | null> {
  const nodes = await listNodesByIds(db, { orgId, nodeIds });
  const assetIds = nodeIds
    .map((id) => nodes.find((n) => n.id === id)?.data.refId)
    .filter((refId): refId is string => typeof refId === 'string');
  if (assetIds.length !== nodeIds.length) {
    return null;
  }
  return assetIds.map((assetId, order) => ({ assetId, order }));
}

export async function proposePaidAd(
  db: Db,
  input: { orgId: string; actor: Actor; draft: PaidAdDraft; now?: Date }
): Promise<ProposeResult> {
  const { draft } = input;
  const problems = draftProblems(draft);
  if (problems.length) {
    return { ok: false, error: 'invalid_draft', problems };
  }

  const account = await findAdAccount(db, { orgId: input.orgId, adAccountId: draft.adAccountId });
  if (!account || account.brandId !== draft.brandId) {
    return { ok: false, error: 'ad_account_not_found' };
  }

  const media = await mediaOf(db, input.orgId, draft.mediaNodeIds);
  if (!media) {
    return { ok: false, error: 'media_not_found' };
  }

  const schedule = scheduleFor(input.now ?? new Date(), draft.days);
  const campaign = await createCampaign(db, {
    orgId: input.orgId,
    brandId: draft.brandId,
    adAccountId: account.id,
    name: draft.headline.trim(),
    objective: draft.objective,
    budgetType: draft.budgetType,
    budgetAmount: draft.budgetAmount,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    targeting: targetingOf(draft),
    placements: draft.placements,
    actor: input.actor
  });

  await createCreative(db, {
    orgId: input.orgId,
    campaignId: campaign.id,
    postId: draft.postId,
    primaryText: draft.primaryText.trim(),
    headline: draft.headline.trim(),
    callToAction: draft.callToAction,
    destinationUrl: normalizeUrl(draft.linkUrl) || null,
    media
  });

  return { ok: true, campaign };
}

export type StoredMedia = { path: string; source: string | null };

export type LaunchDeps = {
  creditBalance: (orgId: string) => Promise<number>;
  publicUrls: (media: StoredMedia[]) => Promise<Map<string, string>>;
};

export type LaunchResult =
  | { ok: true; campaign: AdCampaign }
  | {
      ok: false;
      error:
        | 'campaign_not_approvable'
        | 'credits_exhausted'
        | 'creative_missing'
        | 'ad_account_not_found'
        | 'needs_facebook'
        | 'launch_failed';
      detail?: string;
    };

type MetaIdentity = { zernioAccountId: string; zernioProfileId: string | null; socialAccountId: string };

async function metaIdentity(db: Db, input: { orgId: string; brandId: string }): Promise<MetaIdentity | null> {
  const { data, error } = await db
    .from('social_accounts')
    .select('id, zernio_account_id, zernio_profile_id')
    .eq('org_id', input.orgId)
    .eq('brand_id', input.brandId)
    .eq('platform', META_PUBLISHING_PLATFORM)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return null;
  }
  return { zernioAccountId: data.zernio_account_id, zernioProfileId: data.zernio_profile_id, socialAccountId: data.id };
}

async function mediaUrls(
  db: Db,
  deps: LaunchDeps,
  orgId: string,
  media: CreativeMedia[]
): Promise<{ type: string; url: string }[]> {
  if (!media.length) {
    return [];
  }
  const { data, error } = await db
    .from('assets')
    .select('id, type, url, source')
    .eq('org_id', orgId)
    .in(
      'id',
      media.map((m) => m.assetId)
    );
  if (error) throw error;

  const byId = new Map((data ?? []).map((a) => [a.id, a]));
  const stored = [...media]
    .sort((a, b) => a.order - b.order)
    .map((m) => byId.get(m.assetId))
    .filter((a): a is NonNullable<typeof a> & { url: string } => Boolean(a?.url));
  const signed = await deps.publicUrls(stored.map((a) => ({ path: a.url, source: a.source })));
  return stored
    .map((a) => ({ type: a.type, url: signed.get(a.url) ?? '' }))
    .filter((a) => a.url);
}

async function zernioPostIdOf(db: Db, input: { orgId: string; postId: string; socialAccountId: string }) {
  const { data, error } = await db
    .from('posts')
    .select('zernio_post_ids')
    .eq('org_id', input.orgId)
    .eq('id', input.postId)
    .maybeSingle();
  if (error) throw error;
  const ids = (data?.zernio_post_ids ?? {}) as Record<string, string>;
  return ids[input.socialAccountId] ?? null;
}

async function sendToZernio(
  db: Db,
  deps: LaunchDeps,
  input: { orgId: string; campaign: AdCampaign; creative: AdCreative; identity: MetaIdentity; zernioAdAccountId: string }
): Promise<string> {
  const { campaign, creative, identity } = input;
  const budget = { amount: campaign.budgetAmount, type: campaign.budgetType as 'daily' | 'lifetime' };
  const schedule = { startDate: campaign.startsAt ?? undefined, endDate: campaign.endsAt ?? undefined };
  const targeting = campaign.targeting ?? undefined;
  const common = {
    accountId: identity.zernioAccountId,
    adAccountId: input.zernioAdAccountId,
    name: campaign.name,
    goal: campaign.objective as AdGoal,
    budget,
    schedule,
    targeting
  };

  if (creative.postId) {
    const postId = await zernioPostIdOf(db, { orgId: input.orgId, postId: creative.postId, socialAccountId: identity.socialAccountId });
    const ad = await boostPost(
      {
        ...common,
        postId: postId ?? undefined,
        linkUrl: creative.destinationUrl ?? undefined,
        callToAction: creative.callToAction ?? undefined
      },
      campaign.id
    );
    return ad.platformCampaignId ?? ad.id;
  }

  const [first] = await mediaUrls(db, deps, input.orgId, creative.media);
  const created = await createStandaloneAd(
    {
      ...common,
      creative: {
        headline: creative.headline ?? undefined,
        body: creative.primaryText ?? undefined,
        callToAction: creative.callToAction ?? undefined,
        linkUrl: creative.destinationUrl ?? undefined,
        imageUrl: first?.type === 'video' ? undefined : first?.url,
        videoUrl: first?.type === 'video' ? first.url : undefined
      },
      placements: campaign.placements.length ? placementsPayload(campaign.placements) : undefined
    },
    campaign.id
  );
  return created.platformCampaignId ?? created.ads[0].id;
}

export async function launchCampaign(
  db: Db,
  deps: LaunchDeps,
  input: { orgId: string; campaignId: string; userId: string }
): Promise<LaunchResult> {
  const campaign = await findCampaign(db, { orgId: input.orgId, campaignId: input.campaignId });
  if (!campaign || !isApprovable(campaign)) {
    return { ok: false, error: 'campaign_not_approvable' };
  }

  const creative = await findCreative(db, { orgId: input.orgId, campaignId: campaign.id });
  if (!creative) {
    return { ok: false, error: 'creative_missing' };
  }

  const account = await findAdAccount(db, { orgId: input.orgId, adAccountId: campaign.adAccountId });
  if (!account) {
    return { ok: false, error: 'ad_account_not_found' };
  }

  const identity = await metaIdentity(db, { orgId: input.orgId, brandId: campaign.brandId });
  if (!identity) {
    return { ok: false, error: 'needs_facebook' };
  }

  const fee = launchFee({ budgetType: campaign.budgetType as 'daily' | 'lifetime', budgetAmount: campaign.budgetAmount, days: 1 });
  const needed = creditsForSpend(fee.platformBudget);
  if ((await deps.creditBalance(input.orgId)) < needed) {
    return { ok: false, error: 'credits_exhausted', detail: String(needed) };
  }

  const approved = await approveCampaign(db, { orgId: input.orgId, campaignId: campaign.id, approvedBy: input.userId });
  if (!approved) {
    return { ok: false, error: 'campaign_not_approvable' };
  }

  try {
    const zernioCampaignId = await sendToZernio(db, deps, {
      orgId: input.orgId,
      campaign: approved,
      creative,
      identity,
      zernioAdAccountId: account.zernioAdAccountId
    });
    await recordLaunch(db, { orgId: input.orgId, campaignId: campaign.id, outcome: { zernioCampaignId } });
    chargeAdsCredits({ brandId: campaign.brandId, feeUsd: fee.fee, label: 'ads.launch', campaignId: campaign.id, platform: account.platform });
    return { ok: true, campaign: { ...approved, status: 'active', zernioCampaignId } };
  } catch (e) {
    const detail = (e instanceof Error ? e.message : String(e)).slice(0, ERROR_MAX_LENGTH);
    await recordLaunch(db, { orgId: input.orgId, campaignId: campaign.id, outcome: { error: detail } });
    return { ok: false, error: 'launch_failed', detail };
  }
}

export async function setCampaignRunning(
  db: Db,
  input: { orgId: string; campaignId: string; next: 'active' | 'paused' }
): Promise<{ ok: true } | { ok: false; error: 'not_launched' | 'provider_failed'; detail?: string }> {
  const campaign = await findCampaign(db, { orgId: input.orgId, campaignId: input.campaignId });
  if (!campaign?.zernioCampaignId) {
    return { ok: false, error: 'not_launched' };
  }

  try {
    await updateCampaignStatus(campaign.zernioCampaignId, input.next, META_PUBLISHING_PLATFORM);
  } catch (e) {
    return { ok: false, error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) };
  }

  await setCampaignStatus(db, { orgId: input.orgId, campaignId: campaign.id, status: input.next });
  return { ok: true };
}

export async function syncMetaAdAccounts(
  db: Db,
  input: { orgId: string; brandId: string }
): Promise<{ ok: true; count: number } | { ok: false; error: 'needs_facebook' }> {
  const identity = await metaIdentity(db, input);
  if (!identity?.zernioProfileId) {
    return { ok: false, error: 'needs_facebook' };
  }

  const accounts = await listZernioAdAccounts({ profileId: identity.zernioProfileId });
  for (const account of accounts) {
    await saveMetaAdAccount(db, {
      orgId: input.orgId,
      brandId: input.brandId,
      zernioAdAccountId: account.id,
      externalAccountId: account.platformAdAccountId ?? account.id,
      name: account.name,
      currency: account.currency ?? 'USD'
    });
  }
  return { ok: true, count: accounts.length };
}

export async function metaProfileFor(db: Db, input: { orgId: string; brandId: string }): Promise<string | null> {
  return (await metaIdentity(db, input))?.zernioProfileId ?? null;
}

export type BoostablePost = { id: string; caption: string };

export async function listBoostablePosts(db: Db, input: { orgId: string; brandId: string }): Promise<BoostablePost[]> {
  const { data, error } = await db
    .from('posts')
    .select('id, caption, zernio_post_ids, created_at')
    .eq('org_id', input.orgId)
    .eq('brand_id', input.brandId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .filter((row) => Object.keys((row.zernio_post_ids ?? {}) as Record<string, string>).length > 0)
    .map((row) => ({ id: row.id, caption: row.caption }));
}
