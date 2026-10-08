import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listEffects } from '$lib/server/repos/effects';
import { bodyOf, callerOf, forbidden, storeOf, written } from '$lib/server/effects/http';

const CREATED = 201;

export const GET: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const effects = await listEffects(resolved.caller.db, resolved.caller.orgId);
  return json({ effects: effects ?? [], available: effects !== null });
};

export const POST: RequestHandler = async ({ request, url }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { caller } = resolved;
  if (!caller.writeAllowed) {
    return forbidden();
  }

  return written(await storeOf(caller).write((await bodyOf(request)) as never), CREATED);
};
