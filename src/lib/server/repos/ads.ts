import type { Db } from '$lib/server/db/client';
import type { NarrowedDatabase } from '$lib/server/db/typed-database';
import type { Json } from '$lib/database.types';
import type { Actor } from './actor';
import type { CampaignStatus } from '$lib/ads/campaign-status';

type Tables = NarrowedDatabase['public']['Tables'];
type CampaignRow = Tables['ad_campaigns']['Row'];
type AccountRow = Tables['ad_accounts']['Row'];
type CreativeRow = Tables['ad_creatives']['Row'];
export type AdTargeting = NonNullable<CampaignRow['targeting']>;

export { CAMPAIGN_STATUSES, type CampaignStatus } from '$lib/ads/campaign-status';

const APPROVABLE_STATUSES: CampaignStatus[] = ['draft', 'pending_review'];

export const META_PLATFORM = 'meta';
export const CONNECTED_ACCOUNT_STATUS = 'connected';

export type AdAccount = {
  id: string;
  brandId: string;
  platform: string;
  name: string | null;
  currency: string;
  status: string;
  zernioAdAccountId: string;
};

export type AdCampaign = {
  id: string;
  brandId: string;
  adAccountId: string;
  name: string;
  objective: string;
  budgetType: string;
  budgetAmount: number;
  status: CampaignStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  targeting: AdTargeting | null;
  placements: string[];
  error: string | null;
  zernioCampaignId: string | null;
  createdAt: string;
};

export type CreativeMedia = { assetId: string; order: number };

export type AdCreative = {
  id: string;
  campaignId: string;
  postId: string | null;
  primaryText: string | null;
  headline: string | null;
  callToAction: string | null;
  destinationUrl: string | null;
  media: CreativeMedia[];
};

const ACCOUNT_COLUMNS = 'id, brand_id, platform, name, currency, status, zernio_ad_account_id';
const CAMPAIGN_COLUMNS =
  'id, brand_id, ad_account_id, name, objective, budget_type, budget_amount, status, approved_by, approved_at, starts_at, ends_at, targeting, placements, error, zernio_campaign_id, created_at';
const CREATIVE_COLUMNS = 'id, campaign_id, post_id, primary_text, headline, call_to_action, destination_url, media';

type AccountColumns = Pick<AccountRow, 'id' | 'brand_id' | 'platform' | 'name' | 'currency' | 'status' | 'zernio_ad_account_id'>;
type CampaignColumns = Pick<
  CampaignRow,
  | 'id'
  | 'brand_id'
  | 'ad_account_id'
  | 'name'
  | 'objective'
  | 'budget_type'
  | 'budget_amount'
  | 'status'
  | 'approved_by'
  | 'approved_at'
  | 'starts_at'
  | 'ends_at'
  | 'targeting'
  | 'placements'
  | 'error'
  | 'zernio_campaign_id'
  | 'created_at'
>;
type CreativeColumns = Pick<
  CreativeRow,
  'id' | 'campaign_id' | 'post_id' | 'primary_text' | 'headline' | 'call_to_action' | 'destination_url' | 'media'
>;

function toAccount(row: AccountColumns): AdAccount {
  return {
    id: row.id,
    brandId: row.brand_id,
    platform: row.platform,
    name: row.name,
    currency: row.currency,
    status: row.status,
    zernioAdAccountId: row.zernio_ad_account_id
  };
}

function toCampaign(row: CampaignColumns): AdCampaign {
  return {
    id: row.id,
    brandId: row.brand_id,
    adAccountId: row.ad_account_id,
    name: row.name,
    objective: row.objective,
    budgetType: row.budget_type,
    budgetAmount: Number(row.budget_amount),
    status: row.status as CampaignStatus,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    targeting: row.targeting ?? null,
    placements: row.placements ?? [],
    error: row.error ?? null,
    zernioCampaignId: row.zernio_campaign_id ?? null,
    createdAt: row.created_at
  };
}

function toCreative(row: CreativeColumns): AdCreative {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    postId: row.post_id ?? null,
    primaryText: row.primary_text ?? null,
    headline: row.headline ?? null,
    callToAction: row.call_to_action ?? null,
    destinationUrl: row.destination_url ?? null,
    media: (row.media as CreativeMedia[] | null) ?? []
  };
}

export async function listAdAccounts(db: Db, scope: { orgId: string; brandId: string }): Promise<AdAccount[]> {
  const { data, error } = await db
    .from('ad_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId);

  if (error) throw error;
  return (data ?? []).map(toAccount);
}

export async function findAdAccount(db: Db, input: { orgId: string; adAccountId: string }): Promise<AdAccount | null> {
  const { data, error } = await db
    .from('ad_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('org_id', input.orgId)
    .eq('id', input.adAccountId)
    .maybeSingle();

  if (error) throw error;
  return data ? toAccount(data) : null;
}

export async function saveMetaAdAccount(
  db: Db,
  input: {
    orgId: string;
    brandId: string;
    zernioAdAccountId: string;
    externalAccountId: string;
    name: string | null;
    currency: string;
  }
): Promise<void> {
  const fields = {
    org_id: input.orgId,
    brand_id: input.brandId,
    platform: META_PLATFORM,
    zernio_ad_account_id: input.zernioAdAccountId,
    external_account_id: input.externalAccountId,
    name: input.name,
    currency: input.currency,
    status: CONNECTED_ACCOUNT_STATUS
  };

  const { data: existing, error: readError } = await db
    .from('ad_accounts')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('brand_id', input.brandId)
    .eq('external_account_id', input.externalAccountId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await db
      .from('ad_accounts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('org_id', input.orgId);
    if (error) throw error;
    return;
  }

  const { error } = await db.from('ad_accounts').insert(fields);
  if (error) throw error;
}

export async function listCampaigns(
  db: Db,
  scope: { orgId: string; brandId: string; status?: CampaignStatus }
): Promise<AdCampaign[]> {
  let query = db.from('ad_campaigns').select(CAMPAIGN_COLUMNS).eq('org_id', scope.orgId).eq('brand_id', scope.brandId);
  if (scope.status) query = query.eq('status', scope.status);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCampaign);
}

export async function findCampaign(db: Db, input: { orgId: string; campaignId: string }): Promise<AdCampaign | null> {
  const { data, error } = await db
    .from('ad_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('org_id', input.orgId)
    .eq('id', input.campaignId)
    .maybeSingle();

  if (error) throw error;
  return data ? toCampaign(data) : null;
}

export function isApprovable(campaign: AdCampaign): boolean {
  return APPROVABLE_STATUSES.includes(campaign.status);
}

export async function createCampaign(
  db: Db,
  input: {
    orgId: string;
    brandId: string;
    adAccountId: string;
    name: string;
    objective: string;
    budgetType: string;
    budgetAmount: number;
    startsAt?: string | null;
    endsAt?: string | null;
    targeting?: AdTargeting | null;
    placements?: string[] | null;
    actor: Actor;
  }
): Promise<AdCampaign> {
  const { data, error } = await db
    .from('ad_campaigns')
    .insert({
      org_id: input.orgId,
      brand_id: input.brandId,
      ad_account_id: input.adAccountId,
      name: input.name,
      objective: input.objective,
      budget_type: input.budgetType,
      budget_amount: input.budgetAmount,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      targeting: input.targeting ?? null,
      placements: input.placements ?? null,
      status: 'draft',
      approved_by: null,
      approved_at: null,
      error: null,
      zernio_campaign_id: null,
      actor_kind: input.actor.kind,
      actor_id: input.actor.id,
      agent_key: input.actor.agentKey ?? null,
      created_at: new Date().toISOString()
    })
    .select(CAMPAIGN_COLUMNS)
    .single();

  if (error) throw error;
  return toCampaign(data);
}

export async function createCreative(
  db: Db,
  input: {
    orgId: string;
    campaignId: string;
    postId: string | null;
    primaryText: string;
    headline: string;
    callToAction: string;
    destinationUrl: string | null;
    media: CreativeMedia[];
  }
): Promise<AdCreative> {
  const { data, error } = await db
    .from('ad_creatives')
    .insert({
      org_id: input.orgId,
      campaign_id: input.campaignId,
      post_id: input.postId,
      primary_text: input.primaryText,
      headline: input.headline,
      call_to_action: input.callToAction,
      destination_url: input.destinationUrl,
      media: input.media as unknown as Json,
      status: 'draft'
    })
    .select(CREATIVE_COLUMNS)
    .single();

  if (error) throw error;
  return toCreative(data);
}

export async function findCreative(db: Db, input: { orgId: string; campaignId: string }): Promise<AdCreative | null> {
  const { data, error } = await db
    .from('ad_creatives')
    .select(CREATIVE_COLUMNS)
    .eq('org_id', input.orgId)
    .eq('campaign_id', input.campaignId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toCreative(data) : null;
}

export async function approveCampaign(
  db: Db,
  input: { orgId: string; campaignId: string; approvedBy: string }
): Promise<AdCampaign | null> {
  const { data, error } = await db
    .from('ad_campaigns')
    .update({
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
      status: 'scheduled',
      updated_at: new Date().toISOString()
    })
    .eq('id', input.campaignId)
    .eq('org_id', input.orgId)
    .in('status', APPROVABLE_STATUSES)
    .select(CAMPAIGN_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? toCampaign(data) : null;
}

export async function recordLaunch(
  db: Db,
  input: { orgId: string; campaignId: string; outcome: { zernioCampaignId: string } | { error: string } }
): Promise<void> {
  const patch =
    'error' in input.outcome
      ? { status: 'failed', error: input.outcome.error }
      : { status: 'active', error: null, zernio_campaign_id: input.outcome.zernioCampaignId };

  const { error } = await db
    .from('ad_campaigns')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', input.campaignId)
    .eq('org_id', input.orgId);

  if (error) throw error;
}

export async function setCampaignStatus(
  db: Db,
  input: { orgId: string; campaignId: string; status: CampaignStatus }
): Promise<void> {
  const { error } = await db
    .from('ad_campaigns')
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq('id', input.campaignId)
    .eq('org_id', input.orgId);

  if (error) throw error;
}
