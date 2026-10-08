import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { socialPublishing } from '$lib/server/social-publishing';
import { SocialPublishing } from '$lib/social-publishing';

const OAUTH_RETURN: Record<SocialPublishing, (projectId: string, qs: string) => string> = {
  [SocialPublishing.On]: (projectId, qs) => `/p/${projectId}/settings/connected-accounts?${qs}`,
  [SocialPublishing.Off]: (projectId, qs) => `/p/${projectId}/settings/project?${qs}`
};

export const load: PageServerLoad = async ({ params, url }) => {
  const qs = url.searchParams.toString();
  if (!qs) {
    return {};
  }
  throw redirect(303, OAUTH_RETURN[await socialPublishing()](params.projectId, qs));
};
