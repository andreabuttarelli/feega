import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';

const HTTP_SEE_OTHER = 303;

export const load: PageServerLoad = async (event) => {
  const { projectId } = await toolScope(event);
  throw redirect(HTTP_SEE_OTHER, `/p/${projectId}/settings/api-keys`);
};
