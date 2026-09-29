import { describe, expect, it, vi } from 'vitest';
import { buildAdsPageState } from './ads-page-load';
import type { Brand } from '$lib/server/repos/brands';
import type { AdAccount, AdCampaign } from '$lib/server/repos/ads';
import type { Db } from '$lib/server/db/client';

const db = {} as Db;

const brand: Brand = {
  id: 'brand-1',
  name: 'Acme',
  slug: 'acme',
  website: null,
  shortDescription: null,
  logoUrl: null
};

const adAccount: AdAccount = {
  id: 'acct-1',
  brandId: 'brand-1',
  platform: 'metaads',
  name: 'Acme Meta Ads',
  currency: 'USD',
  status: 'connected',
  zernioAdAccountId: 'z-acct'
};

const campaign: AdCampaign = {
  id: 'camp-1',
  brandId: 'brand-1',
  adAccountId: 'acct-1',
  name: 'Drop',
  objective: 'traffic',
  budgetType: 'daily',
  budgetAmount: 10,
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  startsAt: null,
  endsAt: null,
  targeting: null,
  placements: [],
  error: null,
  zernioCampaignId: null,
  createdAt: '2026-09-29T00:00:00.000Z'
};

describe('buildAdsPageState', () => {
  it('is no_brand when the project has no brand_id', async () => {
    const findBrand = vi.fn();
    const listAdAccounts = vi.fn();
    const listCampaigns = vi.fn();

    const state = await buildAdsPageState(
      { findBrand, listAdAccounts, listCampaigns },
      { orgId: 'org-1', brandId: null, db }
    );

    expect(state).toEqual({ kind: 'no_brand' });
    expect(findBrand).not.toHaveBeenCalled();
  });

  it('is no_brand when brandId points at a brand outside the org', async () => {
    const findBrand = vi.fn().mockResolvedValue(null);
    const listAdAccounts = vi.fn();
    const listCampaigns = vi.fn();

    const state = await buildAdsPageState(
      { findBrand, listAdAccounts, listCampaigns },
      { orgId: 'org-1', brandId: 'brand-1', db }
    );

    expect(state).toEqual({ kind: 'no_brand' });
    expect(listAdAccounts).not.toHaveBeenCalled();
  });

  it('is no_ad_account when the brand has none connected', async () => {
    const findBrand = vi.fn().mockResolvedValue(brand);
    const listAdAccounts = vi.fn().mockResolvedValue([]);
    const listCampaigns = vi.fn();

    const state = await buildAdsPageState(
      { findBrand, listAdAccounts, listCampaigns },
      { orgId: 'org-1', brandId: 'brand-1', db }
    );

    expect(state).toEqual({ kind: 'no_ad_account', brand });
  });

  it('is ready when the brand has at least one ad account', async () => {
    const findBrand = vi.fn().mockResolvedValue(brand);
    const listAdAccounts = vi.fn().mockResolvedValue([adAccount]);
    const listCampaigns = vi.fn().mockResolvedValue([campaign]);

    const state = await buildAdsPageState(
      { findBrand, listAdAccounts, listCampaigns },
      { orgId: 'org-1', brandId: 'brand-1', db }
    );

    expect(state).toEqual({ kind: 'ready', brand, adAccounts: [adAccount], campaigns: [campaign] });
    expect(listCampaigns).toHaveBeenCalledWith(db, { orgId: 'org-1', brandId: 'brand-1' });
  });
});
