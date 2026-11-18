import type { RequestHandler } from './$types';
import { settingsPath, type SettingsSection } from '$lib/settings/sections';
import { ACTION_PARAM } from '$lib/server/api/bearer-page';
import { actionPick, LOAD_PICK, serveSection, type SectionPick } from '$lib/server/settings/serve-section';
import { settingsChain } from '../chain';

const serve = (request: Request, url: URL, projectId: string, section: string, pick: SectionPick) =>
  serveSection({
    request,
    section,
    pick,
    served: () => true,
    chain: (bearer) => {
      const { project, page } = settingsChain(bearer, request, url, settingsPath(projectId, section as SettingsSection), projectId);
      return { gate: project, page };
    }
  });

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params.projectId, params.section, LOAD_PICK);

export const POST: RequestHandler = ({ request, url, params }) => serve(request, url, params.projectId, params.section, actionPick(url.searchParams.get(ACTION_PARAM) ?? ''));
