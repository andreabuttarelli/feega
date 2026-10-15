import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ORG_PARAM, bearerOf } from '$lib/server/api/bearer-page';
import { shellOf } from '$lib/server/dashboard/app-shell';
import { firstRunFlags } from '$lib/server/dashboard/first-run-flags';
import { DASHBOARD_DEPS, dashboardFor, type Dashboard } from '$lib/server/dashboard/dashboard';
import type { Db } from '$lib/server/db/client';

const NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  const { db, user } = bearer;

  const hint = url.searchParams.get(ORG_PARAM);
  const guessed = hint ? recentsOf(db, hint) : null;
  const [shell, flags] = await Promise.all([shellOf(db, user, hint), firstRunFlags(db, user)]);
  if (!shell) {
    return json({ error: 'no_organization' }, { status: NOT_FOUND });
  }

  const dashboard = await (guessed && shell.org.id === hint ? guessed : recentsOf(db, shell.org.id));
  return json({ user: { id: user.id, email: user.email ?? null }, shell, flags, dashboard });
};

function recentsOf(db: Db, orgId: string): Promise<Dashboard> {
  const reads = dashboardFor(db, DASHBOARD_DEPS, orgId);
  reads.catch(() => {});
  return reads;
}
