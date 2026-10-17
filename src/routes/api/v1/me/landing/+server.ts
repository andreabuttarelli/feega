import { json, type Cookies } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ORG_PARAM, bearerOf } from '$lib/server/api/bearer-page';
import { inviteTokenIn, landingPath } from '$lib/server/tenancy/landing';
import { ORG_COOKIE } from '$lib/server/tenancy/context';

function cookieJar(org: string | null): { cookies: Cookies; chosenOrg: () => string | null } {
  const values = new Map<string, string>(org ? [[ORG_COOKIE, org]] : []);
  const cookies = {
    get: (name: string) => values.get(name),
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void values.set(name, value),
    delete: (name: string) => void values.delete(name),
    serialize: () => ''
  } as Cookies;
  return { cookies, chosenOrg: () => values.get(ORG_COOKIE) ?? null };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const jar = cookieJar(url.searchParams.get(ORG_PARAM));
  const redirect = await landingPath(bearer.db, bearer.user, jar.cookies, inviteTokenIn(url.searchParams));
  return json({ redirect, org: jar.chosenOrg() });
};
