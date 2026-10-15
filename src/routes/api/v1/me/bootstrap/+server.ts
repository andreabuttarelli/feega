import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserDb } from '$lib/server/db/client';
import { shellOf } from '$lib/server/dashboard/app-shell';
import { firstRunFlags } from '$lib/server/dashboard/first-run-flags';

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

export const GET: RequestHandler = async ({ request, url }) => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'missing_bearer' }, { status: UNAUTHORIZED });
  }

  const db = createUserDb(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return json({ error: 'invalid_token' }, { status: UNAUTHORIZED });
  }
  const user = data.user;

  const [shell, flags] = await Promise.all([shellOf(db, user, url.searchParams.get('org')), firstRunFlags(db, user)]);
  if (!shell) {
    return json({ error: 'no_organization' }, { status: NOT_FOUND });
  }

  return json({ user: { id: user.id, email: user.email ?? null }, shell, flags });
};
