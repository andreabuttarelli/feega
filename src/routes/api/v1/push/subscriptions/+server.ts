import { json } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { Http, bodyOf, reject } from '$lib/server/cloud/access';
import { vapidFromEnv } from '$lib/server/cloud/notify';
import { readSubscription, removeSubscription, saveSubscription } from '$lib/server/cloud/push-subscriptions';
import { listMemberships } from '$lib/server/repos/orgs';
import { chooseOrg, ORG_COOKIE } from '$lib/server/tenancy/context';

export const GET: RequestHandler = async ({ locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    return reject('unauthorized', Http.Unauthorized);
  }

  return json({ publicKey: vapidFromEnv()?.publicKey ?? null });
};

export const POST: RequestHandler = async ({ request, cookies, locals: { safeGetSession, db } }) => {
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    return reject('unauthorized', Http.Unauthorized);
  }

  const subscription = readSubscription(await bodyOf(request));
  if (!subscription) {
    return reject('invalid_subscription', Http.BadRequest);
  }

  const membership = chooseOrg(await listMemberships(client, user.id), cookies.get(ORG_COOKIE) ?? null);
  if (!membership) {
    return reject('no_organization', Http.BadRequest);
  }

  await saveSubscription(client as unknown as SupabaseClient, { userId: user.id, orgId: membership.org.id }, subscription);

  return json({ ok: true }, { status: Http.Created });
};

export const DELETE: RequestHandler = async ({ request, locals: { safeGetSession, db } }) => {
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    return reject('unauthorized', Http.Unauthorized);
  }

  const { endpoint } = await bodyOf(request);
  if (typeof endpoint !== 'string') {
    return reject('invalid_subscription', Http.BadRequest);
  }

  await removeSubscription(client as unknown as SupabaseClient, user.id, endpoint);

  return json({ ok: true });
};
