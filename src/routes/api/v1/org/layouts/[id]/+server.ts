import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { deleteLayout, patchLayout } from '$lib/server/repos/layouts';
import { Outcome } from '$lib/server/repos/effects';
import { bodyOf, callerOf, forbidden, refused } from '$lib/server/effects/http';

const patchBody = z.object({ version: z.number().int().positive(), spec: z.unknown() });

export const PATCH: RequestHandler = async ({ request, url, params }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { caller } = resolved;
  if (!caller.writeAllowed) {
    return forbidden();
  }

  const body = patchBody.safeParse(await bodyOf(request));
  if (!body.success) {
    return refused(Outcome.Invalid, body.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  const written = await patchLayout(caller.db, caller.orgId, params.id, body.data);
  return written.outcome === Outcome.Ok ? json({ layout: written.layout }) : refused(written.outcome, written.problems);
};

export const DELETE: RequestHandler = async ({ request, url, params }) => {
  const resolved = await callerOf(request, url);
  if ('response' in resolved) {
    return resolved.response;
  }

  const { caller } = resolved;
  if (!caller.writeAllowed) {
    return forbidden();
  }

  const outcome = await deleteLayout(caller.db, caller.orgId, params.id);
  return outcome === Outcome.Ok ? json({ deleted: params.id }) : refused(outcome);
};
