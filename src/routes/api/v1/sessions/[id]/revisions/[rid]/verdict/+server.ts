import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bodyOf, Http, openCloudSessionCall, reject } from '$lib/server/cloud/access';
import { readVerdictInput, setVerdict, VerdictOutcome } from '$lib/server/cloud/revisions';
import { namesOf } from '$lib/server/cloud/sessions';

export const POST: RequestHandler = async ({ request, params }) => {
  const opened = await openCloudSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const input = readVerdictInput(await bodyOf(request));
  if (!input) {
    return reject('invalid_verdict', Http.BadRequest);
  }

  const { call, session, role } = opened;
  const name = (await namesOf(call.supabase, [call.user.id])).get(call.user.id) ?? 'Someone';
  const outcome = await setVerdict(call.supabase, session, params.rid, { id: call.user.id, name, role }, input);
  if (outcome === VerdictOutcome.NotFound) {
    return reject('revision_not_found', Http.NotFound);
  }
  if (outcome === VerdictOutcome.OwnRevision) {
    return reject('own_revision', Http.Forbidden);
  }

  return json({ revisionId: params.rid, verdict: input.verdict });
};
