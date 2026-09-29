import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdsConnectUrl } from '$lib/server/zernio';
import { metaProfileFor } from '$lib/server/ads/paid-ads';
import { projectScope } from '$lib/server/projects/request-scope';

const META_ADS_CONNECT_PLATFORM = 'facebook';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const scope = await projectScope(locals, params.projectId);
  const brandId = scope.project.brandId;
  if (!brandId) {
    throw redirect(303, `/p/${params.projectId}/ads`);
  }

  const profileId = await metaProfileFor(scope.db, { orgId: scope.orgId, brandId });
  if (!profileId) {
    throw redirect(303, `/p/${params.projectId}/settings/connect/facebook`);
  }

  const back = `${url.origin}/p/${params.projectId}/ads?connected=1`;
  const result = await getAdsConnectUrl(profileId, META_ADS_CONNECT_PLATFORM, back, {
    force: url.searchParams.get('force') === '1'
  }).catch((e: unknown) => {
    throw error(502, `Could not start Meta ads connect: ${e instanceof Error ? e.message : String(e)}`);
  });

  throw redirect(303, 'alreadyConnected' in result ? back : result.authUrl);
};
