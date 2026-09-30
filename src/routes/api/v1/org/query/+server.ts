import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveOrgCaller } from '$lib/server/org-data/auth';
import { createOrgQueryTool } from '$lib/server/org-data/query-tool';
import { hiddenFor } from '$lib/server/uncensored-workspace/hidden-scope';

/**
 * `query` sul nuovo schema — org, project, canvas, brand, tutto sotto lo stesso org_id. Non un
 * secondo mestiere: monta lo STESSO tool di `cli/mcp/tools/org-data.ts`, così tetti, traduzione
 * degli errori e confine dell'org sono un pezzo solo.
 *
 * `org` in querystring sceglie quale org quando l'utente ne ha più di una (percorso JWT); una
 * chiave API la ignora — la sua org è quella della chiave, sempre.
 */
export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const resolved = await resolveOrgCaller(bearer, url.searchParams.get('org') ?? undefined);
  if ('error' in resolved) return json(resolved.error.body, { status: resolved.error.status });

  const { authority, orgId, userId, db } = resolved.caller;
  const hidden = await hiddenFor(db, { orgId, userId });
  const { query } = createOrgQueryTool({ authority, orgId, userId, hidden });
  const read = query.execute as (input: unknown, options: unknown) => Promise<unknown>;

  return json(await read(await request.json().catch(() => ({})), {}));
};
