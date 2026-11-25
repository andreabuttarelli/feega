import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appOrigin } from '$lib/server/app-url';
import { bodyOf, Http, openSessionCall, reject } from '$lib/server/cloud/access';
import { createVersion, Outcome } from '$lib/server/cloud/sessions';

const NAME_MAX_CHARS = 80;

export const POST: RequestHandler = async ({ request, params, url }) => {
  const opened = await openSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const { name } = await bodyOf(request);
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > NAME_MAX_CHARS) {
    return reject('invalid_name', Http.BadRequest);
  }

  const created = await createVersion(opened.call.supabase, opened.session, opened.role, trimmed);
  if (created.outcome !== Outcome.Done) {
    return reject('editors_only', Http.Forbidden);
  }

  return json(
    { url: `${appOrigin(url)}/s/${opened.session.id}/snapshot/v/${created.versionId}/index.html`, uploadUrl: created.uploadUrl },
    { status: Http.Created }
  );
};
