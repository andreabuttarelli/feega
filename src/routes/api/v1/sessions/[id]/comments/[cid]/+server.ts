import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ResolveOutcome, resolveComment } from '$lib/server/cloud/comments';
import { bodyOf, Http, openSessionCall, reject } from '$lib/server/cloud/access';

const NOTE_MAX_CHARS = 2000;

export const PATCH: RequestHandler = async ({ request, params }) => {
  const opened = await openSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const body = await bodyOf(request);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, NOTE_MAX_CHARS) || null : null;
  if (body.resolved !== true) {
    return reject('resolved_must_be_true', Http.BadRequest);
  }

  const { call, session, role } = opened;
  const result = await resolveComment(call.supabase, session, params.cid, { id: call.user.id, role }, note, new Date());
  if (result.outcome === ResolveOutcome.NotFound) {
    return reject('comment_not_found', Http.NotFound);
  }
  if (result.outcome === ResolveOutcome.Forbidden) {
    return reject('not_allowed', Http.Forbidden);
  }

  return json(result.comment);
};
