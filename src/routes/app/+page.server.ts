import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ENTRY_DEPS, homePathFor } from '$lib/server/tenancy/entry';
import { ORG_COOKIE } from '$lib/server/tenancy/context';

/**
 * `/app` È DEPRECATO: bookmark ed email vecchie ci atterrano ancora, quindi resta un 308
 * permanente verso la home vera — mai un 404, e nessun codice nuovo ci punta più.
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
  const { session, user } = await locals.safeGetSession();
  if (!session || !user) {
    throw redirect(308, '/login');
  }

  const db = await locals.db();
  if (!db) {
    throw redirect(308, '/login');
  }

  const path = await homePathFor(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null);
  throw redirect(308, path);
};
