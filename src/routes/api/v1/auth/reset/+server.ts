import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { EMAIL_RE, sendPasswordReset } from '$lib/server/auth/accounts';
import { appOrigin } from '$lib/server/app-url';

const BAD_REQUEST = 400;

export const POST: RequestHandler = async ({ request, url }) => {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; locale?: unknown; invite?: unknown };
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ errorCode: 'invalidEmail', email }, { status: BAD_REQUEST });
  }

  const inviteToken = typeof body.invite === 'string' && body.invite ? body.invite : null;
  await sendPasswordReset({ email, locale: String(body.locale ?? ''), base: appOrigin(url), inviteToken });
  return json({ reset: true, email });
};
