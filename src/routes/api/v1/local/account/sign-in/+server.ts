import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { signIn } from '$lib/server/local/cloud-account';
import type { RequestHandler } from './$types';

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const POST: RequestHandler = async ({ request }) => {
  if (!localStore()) {
    error(NOT_FOUND, 'Signing in runs only in local mode');
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = text(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return json({ error: 'missing_fields' }, { status: BAD_REQUEST });
  }

  const linked = await signIn(email, password).catch(() => null);
  if (!linked) {
    return json({ error: 'invalid_credentials' }, { status: UNAUTHORIZED });
  }
  return json(linked);
};
