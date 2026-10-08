import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { shaderParam, textEdit } from '@feega/shader-fx';
import { deleteEffect, Outcome, patchEffect } from '$lib/server/repos/effects';
import { bodyOf, callerOf, forbidden, refused, written } from '$lib/server/effects/http';

const OK = 200;

const patchBody = z.object({
  version: z.number().int().positive(),
  frag: z.string().optional(),
  params: z.array(shaderParam).optional(),
  edits: z.array(textEdit).optional()
});

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

  return written(await patchEffect(caller.db, caller.orgId, params.id, body.data), OK);
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

  const outcome = await deleteEffect(caller.db, caller.orgId, params.id);
  return outcome === Outcome.Ok ? json({ deleted: params.id }) : refused(outcome);
};
