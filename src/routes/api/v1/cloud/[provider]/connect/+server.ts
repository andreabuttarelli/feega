import { error, json, redirect } from '@sveltejs/kit';
import { authorizeUrl, isCloudProvider, sealState } from '$lib/server/cloud/cloud';
import { callbackUrl, credentialsOf } from '$lib/server/cloud/runtime';
import type { RequestHandler } from './$types';

const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_CONFIGURED = 501;
const HTTP_REDIRECT = 302;
const LOCAL_PATH = /^\/(?!\/)/;

export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!isCloudProvider(params.provider)) {
    error(HTTP_NOT_FOUND, 'unknown provider');
  }
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: HTTP_UNAUTHORIZED });
  }
  const creds = credentialsOf(params.provider);
  if (!creds) {
    return json({ error: 'not_configured' }, { status: HTTP_NOT_CONFIGURED });
  }

  const asked = url.searchParams.get('return') ?? '/';
  const returnTo = LOCAL_PATH.test(asked) ? asked : '/';
  const state = sealState({ userId: user.id, provider: params.provider, returnTo });
  redirect(HTTP_REDIRECT, authorizeUrl(params.provider, { clientId: creds.clientId, redirectUri: callbackUrl(url.origin), state }));
};
