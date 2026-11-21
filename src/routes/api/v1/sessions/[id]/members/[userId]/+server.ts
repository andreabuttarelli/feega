import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bodyOf, Http, openSessionCall, reject } from '$lib/server/cloud/access';
import { Outcome, setMemberRole, type VisitorRole } from '$lib/server/cloud/sessions';

const VISITOR_ROLES: readonly string[] = ['viewer', 'editor'];

export const POST: RequestHandler = async ({ request, params }) => {
  const opened = await openSessionCall(request, params.id);
  if (opened instanceof Response) {
    return opened;
  }

  const { role } = await bodyOf(request);
  if (typeof role !== 'string' || !VISITOR_ROLES.includes(role)) {
    return reject('invalid_role', Http.BadRequest);
  }

  const outcome = await setMemberRole(opened.call.supabase, opened.session, opened.call.user.id, params.userId, role as VisitorRole);
  if (outcome === Outcome.NotHost) {
    return reject('host_only', Http.Forbidden);
  }
  if (outcome === Outcome.NotMember) {
    return reject('not_an_org_member', Http.NotFound);
  }

  return json({ ok: true }, { status: Http.Ok });
};
