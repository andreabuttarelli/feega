import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { offerBilling } from '$lib/server/upgrade-offer/eligible';
import { OfferState, personalOffer } from '$lib/server/upgrade-offer/offer';
import { ProductEvent, track } from '$lib/server/product-events/track';
import { CREDIT_LADDER } from '$lib/credit-ladder';
import { BILLING_PATH, checkoutReturnUrls } from '$lib/billing-path';
import { appOrigin } from '$lib/server/app-url';
import type { Db } from '$lib/server/db/client';

const HTTP_SEE_OTHER = 303;
const FIRST_RUNG = CREDIT_LADDER[0];

async function offerCheckout(url: URL, at: { projectId: string; userId: string }, db: Db): Promise<string | null> {
  const billing = await offerBilling(db, at);
  if (!billing) {
    return null;
  }

  const { stripeOfferStore, subscriptionPriceIdFor, ensureOrgCustomer, createSubscriptionCheckout } = await import('$lib/server/stripe');
  const offer = await personalOffer(at.userId, stripeOfferStore, Date.now());
  const priceId = await subscriptionPriceIdFor(FIRST_RUNG.price);
  if (offer.state !== OfferState.Live || !priceId) {
    return null;
  }

  await track(ProductEvent.UpgradeOfferClicked, { userId: at.userId, orgId: billing.orgId }, {});

  const customerId = await ensureOrgCustomer({ id: billing.orgId, name: billing.orgName, stripe_customer_id: billing.customerId });
  return createSubscriptionCheckout({
    customerId,
    orgId: billing.orgId,
    priceId,
    credits: FIRST_RUNG.credits,
    promotionCodeId: offer.promo.id,
    ...checkoutReturnUrls(`${appOrigin(url)}${BILLING_PATH}`)
  });
}

export const GET: RequestHandler = async ({ url, params, locals }) => {
  const { user } = await locals.safeGetSession();
  const db = await locals.db();
  if (!user || !db) {
    redirect(HTTP_SEE_OTHER, '/login');
  }

  const checkout = await offerCheckout(url, { projectId: params.projectId ?? '', userId: user.id }, db).catch((e) => {
    console.warn('[upgrade-offer] checkout unavailable', e);
    return null;
  });
  redirect(HTTP_SEE_OTHER, checkout ?? BILLING_PATH);
};
