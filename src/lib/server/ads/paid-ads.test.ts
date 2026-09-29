import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';
import type { Db } from '$lib/server/db/client';
import type { PaidAdDraft } from '$lib/ads/paid-ad';

vi.mock('$env/dynamic/private', () => ({ env: { ZERNIO_API_KEY: 'test-key' } }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));

const { proposePaidAd, launchCampaign, setCampaignRunning, syncMetaAdAccounts } = await import('./paid-ads');

const ORG = 'org-1';
const BRAND = 'brand-1';
const USER = 'user-1';
const SIGNED = async (media: { path: string }[]) => new Map(media.map((m) => [m.path, `https://signed.test/${m.path}`]));
const RICH = { creditBalance: async () => 1_000_000, publicUrls: SIGNED };
const BROKE = { creditBalance: async () => 0, publicUrls: SIGNED };

const draft: PaidAdDraft = {
  brandId: BRAND,
  adAccountId: 'acct-1',
  objective: 'traffic',
  budgetType: 'daily',
  budgetAmount: 10,
  days: 3,
  countries: ['IT'],
  ageMin: 25,
  ageMax: 45,
  gender: 'female',
  placements: ['facebook_feed', 'instagram_stories'],
  primaryText: 'New drop is live',
  headline: 'Shop the drop',
  callToAction: 'SHOP_NOW',
  linkUrl: 'https://acme.test',
  mediaNodeIds: ['node-img'],
  postId: null
};

function seed(): TestSupabase {
  return createTestSupabase({
    ad_accounts: [
      {
        id: 'acct-1',
        org_id: ORG,
        brand_id: BRAND,
        platform: 'meta',
        name: 'Acme',
        currency: 'EUR',
        status: 'connected',
        zernio_ad_account_id: 'z-adacct',
        external_account_id: 'act_123'
      }
    ],
    social_accounts: [
      { id: 'sa-fb', org_id: ORG, brand_id: BRAND, platform: 'facebook', zernio_account_id: 'z-fb', zernio_profile_id: 'z-prof', status: 'active' }
    ],
    nodes: [{ id: 'node-img', org_id: ORG, canvas_id: 'c1', type: 'image', data: { refId: 'asset-1' }, deleted_at: null }],
    assets: [{ id: 'asset-1', org_id: ORG, type: 'image', url: 'org-1/p1/a.png', source: 'upload' }],
    posts: [{ id: 'post-1', org_id: ORG, brand_id: BRAND, zernio_post_ids: { 'sa-fb': 'z-post-9' } }],
    ad_campaigns: [],
    ad_creatives: []
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function zernioAnswers(body: unknown, status = 200) {
  fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
}

function sentTo(): { url: string; method: string; body: Record<string, unknown> }[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: String((init as RequestInit)?.method ?? 'GET'),
    body: (init as RequestInit)?.body ? JSON.parse(String((init as RequestInit).body)) : {}
  }));
}

beforeEach(() => zernioAnswers({}));
afterEach(() => vi.unstubAllGlobals());

async function proposed(kit: TestSupabase, patch: Partial<PaidAdDraft> = {}) {
  const result = await proposePaidAd(kit.client as unknown as Db, {
    orgId: ORG,
    actor: { kind: 'user', id: USER },
    draft: { ...draft, ...patch }
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.campaign;
}

describe('proposePaidAd', () => {
  it('lands a draft campaign and its creative, and calls no provider', async () => {
    const kit = seed();
    const campaign = await proposed(kit);

    expect(campaign.status).toBe('draft');
    expect(campaign.approvedBy).toBeNull();
    const row = kit.tables.get('ad_campaigns')![0];
    expect(row.placements).toEqual(['facebook_feed', 'instagram_stories']);
    expect(row.targeting).toEqual({ countries: ['IT'], age_min: 25, age_max: 45, genders: ['female'] });
    expect(row.budget_amount).toBe(10);
    expect(row.ends_at).toBeTruthy();

    const creative = kit.tables.get('ad_creatives')![0];
    expect(creative).toMatchObject({
      campaign_id: campaign.id,
      org_id: ORG,
      primary_text: 'New drop is live',
      headline: 'Shop the drop',
      call_to_action: 'SHOP_NOW',
      destination_url: 'https://acme.test/',
      media: [{ assetId: 'asset-1', order: 0 }],
      status: 'draft'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a draft with problems before writing anything', async () => {
    const kit = seed();
    const result = await proposePaidAd(kit.client as unknown as Db, {
      orgId: ORG,
      actor: { kind: 'user', id: USER },
      draft: { ...draft, headline: '' }
    });

    expect(result).toMatchObject({ ok: false, error: 'invalid_draft' });
    expect(kit.tables.get('ad_campaigns')).toEqual([]);
  });

  it('refuses an ad account of another brand', async () => {
    const kit = seed();
    const result = await proposePaidAd(kit.client as unknown as Db, {
      orgId: ORG,
      actor: { kind: 'user', id: USER },
      draft: { ...draft, adAccountId: 'someone-elses' }
    });

    expect(result).toMatchObject({ ok: false, error: 'ad_account_not_found' });
  });
});

describe('launchCampaign — the only path that spends', () => {
  it('approves, then creates the Meta ad on Zernio with the proposed creative', async () => {
    const kit = seed();
    const campaign = await proposed(kit);
    zernioAnswers({ ad: { _id: 'z-ad-1', platformCampaignId: 'meta-camp-1', status: 'ACTIVE' } });

    const result = await launchCampaign(kit.client as unknown as Db, RICH, { orgId: ORG, campaignId: campaign.id, userId: USER });

    expect(result).toMatchObject({ ok: true });
    const [call] = sentTo();
    expect(call.url).toBe('https://zernio.com/api/v1/ads/create');
    expect(call.body).toMatchObject({
      accountId: 'z-fb',
      adAccountId: 'z-adacct',
      goal: 'traffic',
      budgetAmount: 10,
      budgetType: 'daily',
      headline: 'Shop the drop',
      body: 'New drop is live',
      callToAction: 'SHOP_NOW',
      linkUrl: 'https://acme.test/',
      imageUrl: 'https://signed.test/org-1/p1/a.png',
      countries: ['IT'],
      ageMin: 25,
      ageMax: 45,
      genders: ['female'],
      placements: { publisherPlatforms: ['facebook', 'instagram'], facebookPositions: ['feed'], instagramPositions: ['story'] }
    });

    const row = kit.tables.get('ad_campaigns')![0];
    expect(row).toMatchObject({ status: 'active', approved_by: USER, zernio_campaign_id: 'meta-camp-1', error: null });
  });

  it('boosts the published post when the creative comes from one', async () => {
    const kit = seed();
    const campaign = await proposed(kit, { mediaNodeIds: [], postId: 'post-1' });
    zernioAnswers({ ad: { _id: 'z-ad-2', platformCampaignId: 'meta-camp-2' } });

    await launchCampaign(kit.client as unknown as Db, RICH, { orgId: ORG, campaignId: campaign.id, userId: USER });

    const [call] = sentTo();
    expect(call.url).toBe('https://zernio.com/api/v1/ads/boost');
    expect(call.body).toMatchObject({ postId: 'z-post-9', accountId: 'z-fb', adAccountId: 'z-adacct', goal: 'traffic' });
  });

  it('does not call Zernio when the org cannot pay the fee, and leaves the draft untouched', async () => {
    const kit = seed();
    const campaign = await proposed(kit);

    const result = await launchCampaign(kit.client as unknown as Db, BROKE, { orgId: ORG, campaignId: campaign.id, userId: USER });

    expect(result).toMatchObject({ ok: false, error: 'credits_exhausted' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kit.tables.get('ad_campaigns')![0]).toMatchObject({ status: 'draft', approved_by: null });
  });

  it('does not call Zernio twice: a launched campaign cannot be approved again', async () => {
    const kit = seed();
    const campaign = await proposed(kit);
    zernioAnswers({ ad: { _id: 'z-ad-1', platformCampaignId: 'meta-camp-1' } });
    await launchCampaign(kit.client as unknown as Db, RICH, { orgId: ORG, campaignId: campaign.id, userId: USER });
    fetchMock.mockClear();

    const again = await launchCampaign(kit.client as unknown as Db, RICH, { orgId: ORG, campaignId: campaign.id, userId: USER });

    expect(again).toMatchObject({ ok: false, error: 'campaign_not_approvable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the campaign failed with the provider error', async () => {
    const kit = seed();
    const campaign = await proposed(kit);
    zernioAnswers({ error: 'ad account disabled' }, 400);

    const result = await launchCampaign(kit.client as unknown as Db, RICH, { orgId: ORG, campaignId: campaign.id, userId: USER });

    expect(result).toMatchObject({ ok: false, error: 'launch_failed' });
    const row = kit.tables.get('ad_campaigns')![0];
    expect(row.status).toBe('failed');
    expect(String(row.error)).toContain('ad account disabled');
  });
});

describe('setCampaignRunning', () => {
  it('pauses on Meta through Zernio, then records it', async () => {
    const kit = seed();
    const campaign = await proposed(kit);
    zernioAnswers({ ad: { _id: 'z-ad-1', platformCampaignId: 'meta-camp-1' } });
    await launchCampaign(kit.client as unknown as Db, RICH, { orgId: ORG, campaignId: campaign.id, userId: USER });
    zernioAnswers({ status: 'paused' });

    const result = await setCampaignRunning(kit.client as unknown as Db, { orgId: ORG, campaignId: campaign.id, next: 'paused' });

    expect(result).toEqual({ ok: true });
    const [call] = sentTo();
    expect(call).toMatchObject({ url: 'https://zernio.com/api/v1/ads/campaigns/meta-camp-1/status', method: 'PUT', body: { status: 'paused' } });
    expect(kit.tables.get('ad_campaigns')![0].status).toBe('paused');
  });

  it('refuses a campaign that never launched', async () => {
    const kit = seed();
    const campaign = await proposed(kit);

    const result = await setCampaignRunning(kit.client as unknown as Db, { orgId: ORG, campaignId: campaign.id, next: 'paused' });

    expect(result).toEqual({ ok: false, error: 'not_launched' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('syncMetaAdAccounts', () => {
  it('stores the ad accounts Zernio sees on the brand Facebook profile', async () => {
    const kit = seed();
    kit.tables.set('ad_accounts', []);
    zernioAnswers({ accounts: [{ _id: 'z-new', platform: 'facebook', name: 'Acme Ads', currency: 'EUR', platformAdAccountId: 'act_9' }] });

    const result = await syncMetaAdAccounts(kit.client as unknown as Db, { orgId: ORG, brandId: BRAND });

    expect(result).toEqual({ ok: true, count: 1 });
    expect(sentTo()[0].url).toBe('https://zernio.com/api/v1/ads/accounts?profileId=z-prof');
    expect(kit.tables.get('ad_accounts')![0]).toMatchObject({
      org_id: ORG,
      brand_id: BRAND,
      platform: 'meta',
      zernio_ad_account_id: 'z-new',
      external_account_id: 'act_9',
      name: 'Acme Ads',
      currency: 'EUR',
      status: 'connected'
    });
  });

  it('says a Facebook connection is missing instead of calling Zernio', async () => {
    const kit = seed();
    kit.tables.set('social_accounts', []);

    const result = await syncMetaAdAccounts(kit.client as unknown as Db, { orgId: ORG, brandId: BRAND });

    expect(result).toEqual({ ok: false, error: 'needs_facebook' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
