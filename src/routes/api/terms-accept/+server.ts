import { json } from '@sveltejs/kit';
import { recordTermsAcceptance } from '$lib/server/repos/profiles';
import { CURRENT_TERMS_VERSION } from '$lib/legal-links';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals: { safeGetSession, db } }) => {
  const { user } = await safeGetSession();
  if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

  const client = await db();
  if (!client) return json({ error: 'Unauthorized' }, { status: 401 });

  await recordTermsAcceptance(client, user.id, CURRENT_TERMS_VERSION);
  return json({ ok: true });
};
