import { json, redirect } from '@sveltejs/kit';
import { exchangeCode, openState } from '$lib/server/cloud/cloud';
import { callbackUrl, credentialsOf } from '$lib/server/cloud/runtime';
import { cloudTokenStore } from '$lib/server/cloud/token-store';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_GATEWAY = 502;
const HTTP_REDIRECT = 302;
const CONNECTED_PARAM = 'cloud';

export const GET: RequestHandler = async ({ url, locals }) => {
  const state = openState(url.searchParams.get('state') ?? '');
  const code = url.searchParams.get('code');
  if (!state || !code) {
    return json({ error: 'invalid_state' }, { status: HTTP_BAD_REQUEST });
  }
  const { user } = await locals.safeGetSession();
  if (!user || user.id !== state.userId) {
    return json({ error: 'unauthenticated' }, { status: HTTP_UNAUTHORIZED });
  }
  const creds = credentialsOf(state.provider);
  const db = await locals.db();
  if (!creds || !db) {
    return json({ error: 'not_configured' }, { status: HTTP_BAD_GATEWAY });
  }

  const tokens = await exchangeCode(state.provider, { ...creds, redirectUri: callbackUrl(url.origin), code });
  if (!tokens) {
    return json({ error: 'exchange_failed' }, { status: HTTP_BAD_GATEWAY });
  }
  await cloudTokenStore(db, user.id).save(state.provider, tokens);

  const back = new URL(state.returnTo, url.origin);
  back.searchParams.set(CONNECTED_PARAM, state.provider);
  redirect(HTTP_REDIRECT, `${back.pathname}${back.search}`);
};
