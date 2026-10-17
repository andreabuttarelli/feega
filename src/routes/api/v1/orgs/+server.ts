import { json } from '@sveltejs/kit';
import { bearerOf } from '$lib/server/api/bearer-page';
import { orgsOf } from '$lib/server/team/orgs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  return json({ orgs: await orgsOf(bearer.db, bearer.user.id) });
};
