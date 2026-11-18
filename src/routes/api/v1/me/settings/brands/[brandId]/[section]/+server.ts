import type { RequestHandler } from './$types';
import { ACTION_PARAM } from '$lib/server/api/bearer-page';
import { brandSettingsHref, servedForBrand } from '$lib/components/settings/platforms';
import { actionPick, LOAD_PICK, serveSection, type SectionPick } from '$lib/server/settings/serve-section';
import { brandChain } from '../../chain';

const serve = (request: Request, url: URL, brandId: string, section: string, pick: SectionPick) =>
  serveSection({
    request,
    section,
    pick,
    served: servedForBrand,
    chain: (bearer) => brandChain(bearer, request, url, brandSettingsHref(brandId, section), brandId)
  });

export const GET: RequestHandler = ({ request, url, params }) => serve(request, url, params.brandId, params.section, LOAD_PICK);

export const POST: RequestHandler = ({ request, url, params }) => serve(request, url, params.brandId, params.section, actionPick(url.searchParams.get(ACTION_PARAM) ?? ''));
