import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bodyOf, Http, openSessionCall, reject } from '$lib/server/cloud/access';
import { cloudSeats } from '$lib/server/cloud/entitlement';
import { editorsInLive, Outcome, setMemberRole, type VisitorRole } from '$lib/server/cloud/sessions';

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

  const { supabase, user, orgId } = opened.call;
  if (role === 'editor' && opened.session.host_user_id === user.id) {
    const editors = await editorsInLive(supabase, orgId, new Date());
    if (!editors.has(params.userId) && editors.size >= (await cloudSeats(supabase, orgId))) {
      return reject('seats_exhausted', Http.PaymentRequired);
    }
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
