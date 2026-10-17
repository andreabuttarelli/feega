import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bearerOf } from '$lib/server/api/bearer-page';
import { createAdminClient } from '$lib/server/supabase-admin';
import { appOrigin } from '$lib/server/app-url';

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

function inAppPath(next: unknown): next is string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//');
}

export const POST: RequestHandler = async ({ request, url }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const { next } = (await request.json().catch(() => ({}))) as { next?: unknown };
  if (!inAppPath(next) || !bearer.user.email) {
    return json({ error: 'invalid_next' }, { status: BAD_REQUEST });
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: bearer.user.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return json({ error: 'handoff_failed' }, { status: BAD_GATEWAY });
  }

  const params = new URLSearchParams({ token_hash: tokenHash, type: 'magiclink', next });
  return json({ url: `${appOrigin(url)}/auth/confirm?${params}` });
};
