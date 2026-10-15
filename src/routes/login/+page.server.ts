import { redirect } from '@sveltejs/kit';
import { takeOAuthReturn } from '$lib/server/oauth';
import { landingPath } from '$lib/server/tenancy/landing';
import { loginPageOf } from '$lib/login/login-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, locals: { safeGetSession, db } }) => {
  const page = loginPageOf(url);
  const { cliPort, cliState, inviteToken, inviteError } = page;

  const { session, user } = await safeGetSession();
  const client = session && user ? await db() : null;
  if (!user || !client) {
    return page;
  }

  if (inviteError) {
    return { ...page, homeHref: await landingPath(client, user, cookies, null) };
  }

  const oauthReturn = takeOAuthReturn(cookies);
  if (oauthReturn) throw redirect(303, oauthReturn);
  if (cliPort) throw redirect(303, `/cli/callback?cli_port=${cliPort}&cli_state=${cliState}`);
  throw redirect(303, await landingPath(client, user, cookies, inviteToken));
};
