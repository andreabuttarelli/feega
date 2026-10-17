import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createConfirmedAccount } from '$lib/server/auth/accounts';

const CREATED = 201;
const BAD_REQUEST = 400;

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const refused = await createConfirmedAccount(email, password);
  if (refused) {
    return json({ ...refused, email }, { status: BAD_REQUEST });
  }
  return json({ created: true }, { status: CREATED });
};
