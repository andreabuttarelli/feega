import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSettingsSection, settingsPath } from '$lib/settings/sections';
import { SETTINGS_PAGES, type SettingsPage } from '$lib/server/settings/pages';
import { ACTION_PARAM, answerOf, bearerOf } from '$lib/server/api/bearer-page';
import { settingsChain } from '../chain';

const NOT_FOUND = 404;

type Handler = (event: never) => unknown;

const UNKNOWN = () => json({ error: 'not_found' }, { status: NOT_FOUND });
const NOTHING = async () => null;

async function serve(request: Request, url: URL, projectId: string, section: string, pick: (page: SettingsPage) => Handler | undefined): Promise<Response> {
  if (!isSettingsSection(section)) {
    return UNKNOWN();
  }

  const handler = pick(await SETTINGS_PAGES[section]());
  if (!handler) {
    return UNKNOWN();
  }

  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const { project, page } = settingsChain(bearer, request, url, settingsPath(projectId, section), projectId);
  return answerOf(async () => {
    await project();
    return handler(page as never);
  });
}

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params.projectId, params.section, (page) => page.load ?? NOTHING);

export const POST: RequestHandler = ({ request, url, params }) =>
  serve(request, url, params.projectId, params.section, (page) => page.actions?.[url.searchParams.get(ACTION_PARAM) ?? '']);
