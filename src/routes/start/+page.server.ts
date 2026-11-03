import { redirect } from '@sveltejs/kit';
import { START_URL_PARAM, startUrlOf } from '$lib/start-url';
import { ENTRY_DEPS, canvasPath, startProject } from '$lib/server/tenancy/entry';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import { assertPublicUrl } from '$lib/server/tool-guard';
import type { PageServerLoad } from './$types';

const SEE_OTHER = 303;
const HOME = '/app';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
  const startUrl = startUrlOf(url.searchParams.get(START_URL_PARAM));
  if (!startUrl) {
    throw redirect(SEE_OTHER, HOME);
  }

  const { user } = await locals.safeGetSession();
  if (!user) {
    throw redirect(SEE_OTHER, `/login?${START_URL_PARAM}=${encodeURIComponent(startUrl)}`);
  }

  const reachable = await assertPublicUrl(new URL(startUrl)).then(() => true, () => false);
  if (!reachable) {
    throw redirect(SEE_OTHER, HOME);
  }

  const db = await locals.db();
  if (!db) {
    throw redirect(SEE_OTHER, HOME);
  }

  const { projectId, canvasId } = await startProject(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null, startUrl);
  throw redirect(SEE_OTHER, `${canvasPath(projectId, canvasId)}?${START_URL_PARAM}=${encodeURIComponent(startUrl)}`);
};
