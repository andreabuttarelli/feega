import { json } from '@sveltejs/kit';
import { TourWrite, markTourSeen } from '$lib/server/repos/profiles';
import { ProductEvent, track } from '$lib/server/product-events/track';
import type { RequestHandler } from './$types';

const HTTP_UNAUTHORIZED = 401;

export const POST: RequestHandler = async ({ locals: { safeGetSession, db } }) => {
  const { user } = await safeGetSession();
  const client = user ? await db() : null;
  if (!user || !client) {
    return json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const saved = (await markTourSeen(client, user.id)) === TourWrite.Saved;
  if (saved) {
    await track(ProductEvent.OnboardingTourCompleted, { userId: user.id }, {});
  }
  return json({ saved });
};
