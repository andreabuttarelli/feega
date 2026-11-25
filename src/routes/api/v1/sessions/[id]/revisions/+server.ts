import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bodyOf, Http, openCloudSessionCall, reject } from '$lib/server/cloud/access';
import { addRevision, listRevisions, readRevisionInput, ReviewStatus, RevisionCheck } from '$lib/server/cloud/revisions';
import { namesOf } from '$lib/server/cloud/sessions';

export const GET: RequestHandler = async ({ request, params }) => {
  const opened = await openCloudSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const revisions = await listRevisions(opened.call.supabase, opened.session.id);

  return json({ status: revisions.at(-1)?.status ?? ReviewStatus.Open, revisions });
};

export const POST: RequestHandler = async ({ request, params }) => {
  const opened = await openCloudSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }
  if (opened.role !== 'host') {
    return reject('not_host', Http.Forbidden);
  }

  const read = readRevisionInput(await bodyOf(request));
  if (read.check !== RevisionCheck.Valid) {
    return reject(read.check, Http.BadRequest);
  }

  const { supabase, user } = opened.call;
  const name = (await namesOf(supabase, [user.id])).get(user.id) ?? 'Someone';

  return json(await addRevision(supabase, opened.session, { id: user.id, name }, read.input), { status: Http.Created });
};
