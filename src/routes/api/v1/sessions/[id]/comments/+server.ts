import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addComment, CommentCheck, listComments, readCommentInput } from '$lib/server/cloud/comments';
import { bodyOf, Http, openSessionCall, reject } from '$lib/server/cloud/access';
import { namesOf } from '$lib/server/cloud/sessions';

const OPEN_FLAG = '1';

export const GET: RequestHandler = async ({ request, params, url }) => {
  const opened = await openSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const comments = await listComments(opened.call.supabase, opened.session.id, url.searchParams.get('open') === OPEN_FLAG);

  return json({ comments });
};

export const POST: RequestHandler = async ({ request, params }) => {
  const opened = await openSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const read = readCommentInput(await bodyOf(request));
  if (read.check !== CommentCheck.Valid) {
    return reject(read.check, Http.BadRequest);
  }

  const { supabase, user } = opened.call;
  const name = (await namesOf(supabase, [user.id])).get(user.id) ?? 'Someone';
  const comment = await addComment(supabase, opened.session, { id: user.id, name }, read.input);

  return json(comment, { status: Http.Created });
};
