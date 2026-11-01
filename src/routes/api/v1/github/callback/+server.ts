import { json, redirect } from '@sveltejs/kit';
import { openConnectState } from '$lib/server/code-import/github-access';
import { githubFor } from '$lib/server/code-import/github-runtime';
import { localPath } from '$lib/server/code-import/github-http';
import type { RequestHandler } from './$types';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_REDIRECT = 302;
const RESULT_PARAM = 'github';

enum Landing {
  Connected = 'connected',
  Failed = 'failed'
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const state = openConnectState(url.searchParams.get('state') ?? '');
  const accountId = url.searchParams.get('connected_account_id');
  if (!state || !accountId) {
    return json({ error: 'invalid_state' }, { status: HTTP_BAD_REQUEST });
  }
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || user.id !== state.userId || !db) {
    return json({ error: 'unauthenticated' }, { status: HTTP_UNAUTHORIZED });
  }

  const confirmed = await githubFor(db, { orgId: state.orgId, userId: state.userId }).confirm(accountId);
  const back = new URL(localPath(state.returnTo), url.origin);
  back.searchParams.set(RESULT_PARAM, confirmed ? Landing.Connected : Landing.Failed);
  redirect(HTTP_REDIRECT, `${back.pathname}${back.search}`);
};
