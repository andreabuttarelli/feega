import type { SupabaseClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { can, OrgAction, type OrgRole } from '$lib/org-roles';
import { openOrg, type OrgCall } from '$lib/server/cli-auth';
import { cloudEntitled } from './entitlement';
import { isSid } from './sid';
import { roleIn, sessionFor, type SessionRole, type SessionRow } from './sessions';

export enum Http {
  Ok = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  ServerError = 500
}

export function reject(error: string, status: Http): Response {
  return json({ error }, { status });
}

export async function mayEdit(db: SupabaseClient, orgId: string, userId: string): Promise<boolean> {
  const { data } = await db.from('orgs_members').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
  const role = (data as { role: OrgRole } | null)?.role;

  return role ? can(role, OrgAction.Edit) : false;
}

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);

  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

export type SessionCall = { call: OrgCall; session: SessionRow; role: SessionRole };

export async function openSessionCall(request: Request, id: string): Promise<SessionCall | Response> {
  const opened = await openOrg(request);
  if (opened.error) {
    return opened.error;
  }

  const { call } = opened;
  const session = isSid(id) ? await sessionFor(call.supabase, id, call.orgId) : null;
  if (!session) {
    return reject('session_not_found', Http.NotFound);
  }

  const role = await roleIn(call.supabase, session, call.user.id);
  if (!role) {
    return reject('removed_from_session', Http.Forbidden);
  }

  return { call, session, role };
}

export async function openCloudSessionCall(request: Request, id: string): Promise<SessionCall | Response> {
  const opened = await openSessionCall(request, id);
  if (opened instanceof Response) {
    return opened;
  }

  if (!(await cloudEntitled(opened.call.supabase, opened.session.org_id))) {
    return reject('plan_required', Http.PaymentRequired);
  }

  return opened;
}
