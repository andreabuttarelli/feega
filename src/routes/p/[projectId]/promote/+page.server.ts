import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listNodesByIds } from '$lib/server/repos/canvas';
import { listOrgBrands } from '$lib/server/repos/brands';
import { listBrandAccounts, type SocialAccount } from '$lib/server/repos/social-accounts';
import { listAdAccounts, type AdAccount } from '$lib/server/repos/ads';
import { findAssets } from '$lib/server/repos/assets';
import { listBoostablePosts, proposePaidAd, type BoostablePost } from '$lib/server/ads/paid-ads';
import { projectScope } from '$lib/server/projects/request-scope';
import { tabFromQuery } from '$lib/canvas/promote-sheet';
import { parsePaidAdForm } from '$lib/ads/paid-ad-form';

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const nodeIds = url.searchParams.get('nodeIds')?.split(',').filter(Boolean) ?? [];
  const { db, orgId, project } = await projectScope(locals, params.projectId);

  const [nodeRecords, brands] = await Promise.all([listNodesByIds(db, { orgId, nodeIds }), listOrgBrands(db, orgId)]);

  const accountsByBrand: Record<string, SocialAccount[]> = {};
  const adAccountsByBrand: Record<string, AdAccount[]> = {};
  const boostableByBrand: Record<string, BoostablePost[]> = {};
  for (const brand of brands) {
    const scope = { orgId, brandId: brand.id };
    [accountsByBrand[brand.id], adAccountsByBrand[brand.id], boostableByBrand[brand.id]] = await Promise.all([
      listBrandAccounts(db, scope),
      listAdAccounts(db, scope),
      listBoostablePosts(db, scope)
    ]);
  }

  const canvasId = nodeRecords[0]?.canvasId ?? null;
  const refIdOf = (data: Record<string, unknown>) => (typeof data.refId === 'string' ? data.refId : null);
  const assets = await findAssets(db, {
    orgId,
    assetIds: nodeRecords.map((node) => refIdOf(node.data)).filter((id): id is string => id !== null)
  });

  const nodes = nodeRecords.map((node) => {
    const refId = refIdOf(node.data);
    return {
      id: node.id,
      type: node.type,
      data: node.data,
      text: refId ? (assets.get(refId)?.content ?? null) : null,
      mediaUrl: refId && canvasId ? `/p/${project.id}/c/${canvasId}/assets/${refId}` : null
    };
  });

  return {
    nodes,
    brands,
    accountsByBrand,
    adAccountsByBrand,
    boostableByBrand,
    projectBrandId: project.brandId,
    canvasId,
    tab: tabFromQuery(url.searchParams.get('tab'))
  };
};

export const actions: Actions = {
  propose_ad: async ({ params, request, locals }) => {
    const { db, orgId, userId } = await projectScope(locals, params.projectId);
    const result = await proposePaidAd(db, {
      orgId,
      actor: { kind: 'user', id: userId },
      draft: parsePaidAdForm(await request.formData())
    });
    return result.ok ? { campaign: result.campaign } : fail(422, result);
  }
};
