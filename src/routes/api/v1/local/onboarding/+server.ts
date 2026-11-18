import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { markSeen, onboardingState } from '$lib/server/local/onboarding-state';
import { account } from '$lib/server/local/cloud-account';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const NO_CONTENT = 204;

function requireLocal() {
  if (!localStore()) {
    error(NOT_FOUND, 'Onboarding runs only in local mode');
  }
}

export const GET: RequestHandler = async () => {
  requireLocal();
  const [state, linked] = await Promise.all([onboardingState(), account()]);
  return json({ seenAt: state.seenAt, account: linked });
};

export const PUT: RequestHandler = async () => {
  requireLocal();
  await markSeen();
  return new Response(null, { status: NO_CONTENT });
};
