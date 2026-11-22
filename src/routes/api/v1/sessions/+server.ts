import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { openOrg } from '$lib/server/cli-auth';
import { appOrigin } from '$lib/server/app-url';
import { bodyOf, Http, mayEdit, reject } from '$lib/server/cloud/access';
import { cloudEntitled } from '$lib/server/cloud/entitlement';
import { visitorOrigin } from '$lib/server/cloud/hosts';
import { dbNotifyStore } from '$lib/server/cloud/notify-db';
import { notifySessionShared, vapidFromEnv } from '$lib/server/cloud/notify';
import { liveSessions, namesOf, startSession, type VisitorRole } from '$lib/server/cloud/sessions';
import { signToken } from '$lib/server/cloud/token';

const PROJECT_NAME_MAX_CHARS = 200;
const VISITOR_ROLES: readonly string[] = ['viewer', 'editor'];
const MS_PER_SECOND = 1000;
const LIVE_STATUS = 'live';

export const POST: RequestHandler = async ({ request, url }) => {
  const opened = await openOrg(request);
  if (opened.error) {
    return opened.error;
  }

  const { supabase, user, orgId } = opened.call;
  const body = await bodyOf(request);
  const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : '';
  if (!projectName || projectName.length > PROJECT_NAME_MAX_CHARS) {
    return reject('invalid_project_name', Http.BadRequest);
  }
  if (typeof body.visitorRole !== 'string' || !VISITOR_ROLES.includes(body.visitorRole)) {
    return reject('invalid_visitor_role', Http.BadRequest);
  }

  if (!(await cloudEntitled(supabase, orgId))) {
    return reject('plan_required', Http.PaymentRequired);
  }
  if (!(await mayEdit(supabase, orgId, user.id))) {
    return reject('view_only', Http.Forbidden);
  }

  const secret = env.RELAY_SIGNING_SECRET;
  if (!secret) {
    return reject('relay_not_configured', Http.ServerError);
  }

  const session = await startSession(supabase, { orgId, hostId: user.id, projectName, visitorRole: body.visitorRole as VisitorRole, now: new Date() });
  const hostToken = await signToken(
    { sid: session.id, role: 'host', sub: user.id, org: orgId, exp: Math.floor(new Date(session.expires_at).getTime() / MS_PER_SECOND) },
    secret
  );

  const hostName = (await namesOf(supabase, [user.id])).get(user.id) ?? 'Someone';
  await notifySessionShared({ store: dbNotifyStore, keys: vapidFromEnv() }, session, hostName, appOrigin(url)).catch(() => 0);

  return json({ id: session.id, url: visitorOrigin(session.id), hostToken, expiresAt: session.expires_at }, { status: Http.Created });
};

export const GET: RequestHandler = async ({ request, url }) => {
  const opened = await openOrg(request);
  if (opened.error) {
    return opened.error;
  }

  const { supabase, orgId } = opened.call;
  const status = url.searchParams.get('status') ?? LIVE_STATUS;
  if (status !== LIVE_STATUS) {
    return reject('unsupported_status', Http.BadRequest);
  }

  const sessions = await liveSessions(supabase, orgId, new Date());

  return json({
    sessions: sessions.map(({ row, hostName }) => ({
      id: row.id,
      url: visitorOrigin(row.id),
      projectName: row.project_name,
      hostName,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      status: row.status
    }))
  });
};
