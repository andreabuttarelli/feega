import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { configuredDidit, settleDidit } from '$lib/server/uncensored-workspace/workspace-server';

const HTTP_UNAUTHORIZED = 401;
const HTTP_UNAVAILABLE = 503;

export const POST: RequestHandler = async ({ request }) => {
  const didit = configuredDidit();
  if (!didit) {
    return json({ error: 'age_verification_not_configured' }, { status: HTTP_UNAVAILABLE });
  }

  const result = didit.readWebhook(await request.text(), request.headers);
  if (!result) {
    return json({ error: 'invalid_signature' }, { status: HTTP_UNAUTHORIZED });
  }

  await settleDidit(didit, result);
  return json({ ok: true });
};
