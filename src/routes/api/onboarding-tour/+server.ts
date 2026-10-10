import { json } from '@sveltejs/kit';
import { TourWrite, markTourSeen } from '$lib/server/repos/profiles';
import type { RequestHandler } from './$types';

const HTTP_UNAUTHORIZED = 401;

export const POST: RequestHandler = async ({ locals: { safeGetSession, db } }) => {
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    return json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  return json({ saved: (await markTourSeen(client, user.id)) === TourWrite.Saved });
};
