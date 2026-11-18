import type { RequestHandler } from './$types';
import { ACTION_PARAM } from '$lib/server/api/bearer-page';
import { servedOnDashboard } from '$lib/components/settings/platforms';
import { DASHBOARD_SETTINGS_PATH } from '$lib/settings/paths';
import { actionPick, LOAD_PICK, serveSection, type SectionPick } from '$lib/server/settings/serve-section';
import { dashboardChain } from '../chain';

const serve = (request: Request, url: URL, section: string, pick: SectionPick) =>
  serveSection({
    request,
    section,
    pick,
    served: servedOnDashboard,
    chain: (bearer) => {
      const { org, page } = dashboardChain(bearer, request, url, `${DASHBOARD_SETTINGS_PATH}/${section}`);
      return { gate: org, page };
    }
  });

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params.section, LOAD_PICK);

export const POST: RequestHandler = ({ request, url, params }) => serve(request, url, params.section, actionPick(url.searchParams.get(ACTION_PARAM) ?? ''));
