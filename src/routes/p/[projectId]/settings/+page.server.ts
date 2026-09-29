import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const qs = url.searchParams.toString();
  if (!qs) {
    return {};
  }
  throw redirect(303, `/p/${params.projectId}/settings/connected-accounts?${qs}`);
};
