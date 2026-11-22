import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openOrg } from '$lib/server/cli-auth';
import { orgHasCloud } from '$lib/server/library/cloud-entitlement';
import { ProFetch, proFiles } from '$lib/server/library/pro-library';
import { storageStore } from '$lib/server/library/storage-store';

enum Http {
  BadRequest = 400,
  PaymentRequired = 402,
  NotFound = 404
}

const CLOUD_MESSAGE = 'Included in Feega Cloud';

const REFUSALS = {
  [ProFetch.BadRequest]: Http.BadRequest,
  [ProFetch.PlanRequired]: Http.PaymentRequired,
  [ProFetch.ItemNotFound]: Http.NotFound,
  [ProFetch.FrameworkNotFound]: Http.NotFound
} as const;

export const GET: RequestHandler = async ({ request, params, url }) => {
  const opened = await openOrg(request);
  if (opened.error) {
    return opened.error;
  }

  const { supabase, orgId } = opened.call;
  const result = await proFiles(storageStore(), () => orgHasCloud(supabase, orgId), params.id, url.searchParams.get('framework') ?? '');
  if (result.kind === ProFetch.Served) {
    return json({ id: result.id, version: result.version, framework: result.framework, files: result.files });
  }

  const body = result.kind === ProFetch.PlanRequired ? { error: result.kind, message: CLOUD_MESSAGE } : { error: result.kind };

  return json(body, { status: REFUSALS[result.kind] });
};
