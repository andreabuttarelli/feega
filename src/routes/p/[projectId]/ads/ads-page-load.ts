import type { Db } from '$lib/server/db/client';
import type { Brand } from '$lib/server/repos/brands';
import type { AdAccount } from '$lib/server/repos/ads';

/**
 * LO STATO DELLA PAGINA SOCIAL ADS, in un unico posto: senza brand si mostra la scelta/creazione
 * brand, con brand ma senza ad account si mostra il collegamento a Meta Ads, altrimenti la
 * pagina reale (oggi vuota — le campagne vivono in `ad_campaigns`, non ancora scritte da nessuno).
 */
export type AdsSocialState =
  | { kind: 'no_brand' }
  | { kind: 'no_ad_account'; brand: Brand }
  | { kind: 'ready'; brand: Brand; adAccounts: AdAccount[] };

type AdsSocialRepos = {
  findBrand: (db: Db, input: { orgId: string; brandId: string }) => Promise<Brand | null>;
  listAdAccounts: (db: Db, scope: { orgId: string; brandId: string }) => Promise<AdAccount[]>;
};

export async function buildAdsSocialState(
  repos: AdsSocialRepos,
  input: { orgId: string; brandId: string | null; db: Db }
): Promise<AdsSocialState> {
  if (!input.brandId) {
    return { kind: 'no_brand' };
  }

  const brand = await repos.findBrand(input.db, { orgId: input.orgId, brandId: input.brandId });
  if (!brand) {
    return { kind: 'no_brand' };
  }

  const adAccounts = await repos.listAdAccounts(input.db, { orgId: input.orgId, brandId: brand.id });
  if (adAccounts.length === 0) {
    return { kind: 'no_ad_account', brand };
  }

  return { kind: 'ready', brand, adAccounts };
}
