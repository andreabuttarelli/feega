import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findBrand } from '$lib/server/repos/brands';
import { listAdAccounts } from '$lib/server/repos/ads';
import { buildAdsSocialState } from './ads-social-load';

/**
 * SOCIAL ADS: stesso brand del calendario, risolto dallo schema vero (vedi
 * `src/lib/server/repos/brands.ts` — `+layout.server`'s `brand` legge colonne che qui non
 * esistono e torna sempre `null`). Lo stato della pagina è uno solo, deciso da
 * `buildAdsSocialState`: senza brand, senza ad account, o pronta.
 */
export const load: PageServerLoad = async ({ parent, locals }) => {
  const { project, org } = await parent();
  const db = await locals.db();
  if (!db) throw error(500, 'sessione senza client');

  const state = await buildAdsSocialState(
    { findBrand, listAdAccounts },
    { orgId: org.id, brandId: project.brandId, db }
  );

  return { state };
};
