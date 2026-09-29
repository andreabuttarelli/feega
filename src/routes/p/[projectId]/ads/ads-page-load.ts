import type { Db } from '$lib/server/db/client';
import type { Brand } from '$lib/server/repos/brands';
import type { AdAccount, AdCampaign } from '$lib/server/repos/ads';

export type AdsPageState =
  | { kind: 'no_brand' }
  | { kind: 'no_ad_account'; brand: Brand }
  | { kind: 'ready'; brand: Brand; adAccounts: AdAccount[]; campaigns: AdCampaign[] };

type AdsPageRepos = {
  findBrand: (db: Db, input: { orgId: string; brandId: string }) => Promise<Brand | null>;
  listAdAccounts: (db: Db, scope: { orgId: string; brandId: string }) => Promise<AdAccount[]>;
  listCampaigns: (db: Db, scope: { orgId: string; brandId: string }) => Promise<AdCampaign[]>;
};

export async function buildAdsPageState(
  repos: AdsPageRepos,
  input: { orgId: string; brandId: string | null; db: Db }
): Promise<AdsPageState> {
  if (!input.brandId) {
    return { kind: 'no_brand' };
  }

  const brand = await repos.findBrand(input.db, { orgId: input.orgId, brandId: input.brandId });
  if (!brand) {
    return { kind: 'no_brand' };
  }

  const scope = { orgId: input.orgId, brandId: brand.id };
  const adAccounts = await repos.listAdAccounts(input.db, scope);
  if (adAccounts.length === 0) {
    return { kind: 'no_ad_account', brand };
  }

  const campaigns = await repos.listCampaigns(input.db, scope);
  return { kind: 'ready', brand, adAccounts, campaigns };
}
