import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bearerOf } from '$lib/server/api/bearer-page';
import { ensureProfile, saveName } from '$lib/server/repos/profiles';
import { NAME_MAX_CHARS } from '$lib/onboarding/limits';

const BAD_REQUEST = 400;

export const GET: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const profile = await ensureProfile(bearer.db, bearer.user);
  return json({ name: profile.name });
};

export const PUT: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  const { db, user } = bearer;

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > NAME_MAX_CHARS) {
    return json({ error: 'invalid_name' }, { status: BAD_REQUEST });
  }

  await saveName(db, user.id, name);
  return json({ name });
};
