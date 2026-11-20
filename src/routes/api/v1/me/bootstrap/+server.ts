import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ORG_PARAM, bearerOf } from '$lib/server/api/bearer-page';
import { shellOf } from '$lib/server/dashboard/app-shell';
import { firstRunFlags } from '$lib/server/dashboard/first-run-flags';

const NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  const { db, user } = bearer;

  const [shell, flags] = await Promise.all([shellOf(db, user, url.searchParams.get(ORG_PARAM)), firstRunFlags(db, user)]);
  if (!shell) {
    return json({ error: 'no_organization' }, { status: NOT_FOUND });
  }

  return json({ data: { user: { id: user.id, email: user.email ?? null }, shell, flags } });
};
