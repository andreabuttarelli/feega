import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appOrigin } from '$lib/server/app-url';
import { cronAuthorized } from '$lib/server/cron-auth';
import { runDigest } from '$lib/server/cloud/digest';
import { dbNotifyStore } from '$lib/server/cloud/notify-db';
import { vapidFromEnv } from '$lib/server/cloud/notify';

const UNAUTHORIZED = 401;

export const GET: RequestHandler = async ({ request, url }) => {
  if (!cronAuthorized(request)) {
    return new Response('Unauthorized', { status: UNAUTHORIZED });
  }

  const tally = await runDigest({ store: dbNotifyStore, keys: vapidFromEnv(), appUrl: appOrigin(url) }, new Date());

  return json(tally);
};
