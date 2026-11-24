import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { snapshotFile, SNAPSHOT_CSP } from '$lib/server/cloud/snapshot';

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

export const GET: RequestHandler = async ({ params, locals: { safeGetSession, db } }) => {
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    return new Response('Unauthorized', { status: UNAUTHORIZED });
  }

  const file = await snapshotFile(client as unknown as SupabaseClient, params.id, params.path);
  if (!file) {
    return new Response('Not found', { status: NOT_FOUND });
  }

  return new Response(file.body as BodyInit, {
    headers: {
      'content-type': file.contentType,
      'content-security-policy': SNAPSHOT_CSP,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=300'
    }
  });
};
