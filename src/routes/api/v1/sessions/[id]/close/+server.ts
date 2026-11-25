import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Http, openSessionCall, reject } from '$lib/server/cloud/access';
import { closeSession, Outcome } from '$lib/server/cloud/sessions';

export const POST: RequestHandler = async ({ request, params }) => {
  const opened = await openSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const closed = await closeSession(opened.call.supabase, opened.session, opened.call.user.id, new Date());
  if (closed.outcome === Outcome.NotHost) {
    return reject('host_only', Http.Forbidden);
  }

  return json({ snapshotUploadUrl: closed.uploadUrl }, { status: Http.Ok });
};
