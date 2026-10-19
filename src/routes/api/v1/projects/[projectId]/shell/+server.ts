import type { RequestHandler } from './$types';
import { servePage, type PageHandler } from '$lib/server/api/bearer-page';
import { load, rememberProject } from '$lib/server/projects/project-shell';

const OK = 200;

export const GET: RequestHandler = async ({ request, url, params, cookies }) => {
  const answer = await servePage(request, url, `/p/${params.projectId}`, params, load as PageHandler);
  if (answer.status === OK) {
    rememberProject(cookies, params.projectId);
  }
  return answer;
};
