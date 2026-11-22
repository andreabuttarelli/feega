import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openOrg } from '$lib/server/cli-auth';
import { Http, reject } from '$lib/server/cloud/access';
import { cloudEntitled } from '$lib/server/cloud/entitlement';
import { Fetch, itemFiles } from '$lib/server/library/library';
import { storageStore } from '$lib/server/library/storage-store';

const REFUSALS = {
  [Fetch.BadRequest]: Http.BadRequest,
  [Fetch.ItemNotFound]: Http.NotFound,
  [Fetch.FrameworkNotFound]: Http.NotFound,
  [Fetch.PlanRequired]: Http.PaymentRequired
} as const;

export const GET: RequestHandler = async ({ request, params }) => {
  const opened = await openOrg(request);
  if (opened.error) {
    return opened.error;
  }

  const { supabase, orgId } = opened.call;
  const result = await itemFiles(storageStore(), () => cloudEntitled(supabase, orgId), params.id, params.framework);
  if (result.kind !== Fetch.Served) {
    return reject(result.kind, REFUSALS[result.kind]);
  }

  return json({ id: result.id, framework: result.framework, files: result.files });
};
