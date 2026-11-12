import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { offerBilling } from '$lib/server/upgrade-offer/eligible';
import { OfferState, personalOffer } from '$lib/server/upgrade-offer/offer';
import { OfferReason } from '$lib/upgrade-offer';
import { ProductEvent, track } from '$lib/server/product-events/track';

const NONE = { state: 'none' } as const;
const REASONS = new Set<string>(Object.values(OfferReason));

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
  if (!reason || !REASONS.has(reason)) {
    return json({ error: 'invalid_reason' }, { status: 400 });
  }

  const billing = await offerBilling(db, { projectId: params.projectId ?? '', userId: user.id });
  if (!billing) {
    return json(NONE);
  }

  try {
    const { stripeOfferStore } = await import('$lib/server/stripe');
    const offer = await personalOffer(user.id, stripeOfferStore, Date.now());
    const actor = { userId: user.id, orgId: billing.orgId };

    if (offer.newlyRedeemed) {
      await track(ProductEvent.UpgradeOfferRedeemed, actor, {});
    }
    if (offer.state !== OfferState.Live) {
      return json(NONE);
    }

    await track(ProductEvent.UpgradeOfferShown, actor, { reason, created: offer.created });
    return json({ state: offer.state, expiresAt: offer.expiresAt });
  } catch (e) {
    console.warn('[upgrade-offer] unavailable', e);
    return json(NONE);
  }
};
