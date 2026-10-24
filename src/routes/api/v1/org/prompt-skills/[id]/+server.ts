import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deletePromptSkill } from '$lib/server/repos/prompt-skills';
import { Outcome } from '$lib/server/repos/effects';
import { callerOf, forbidden, refused } from '$lib/server/effects/http';

export const DELETE: RequestHandler = async ({ request, url, params }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { caller } = resolved;
  if (!caller.writeAllowed) {
    return forbidden();
  }

  const outcome = await deletePromptSkill(caller.db, caller.orgId, params.id);
  return outcome === Outcome.Ok ? json({ deleted: params.id }) : refused(outcome);
};
