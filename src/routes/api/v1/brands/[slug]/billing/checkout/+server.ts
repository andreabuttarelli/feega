import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticate, checkApiKeyWriteAccess, loadBrandForUser } from '$lib/server/cli-auth';
import { isOrgOwner, orgBillingForBrand } from '$lib/server/org-billing';
import { billingGrantsReady } from '$lib/server/billing-readiness';
import { PLAN } from '$lib/credit-ladder';
import { BILLING_PATH, checkoutReturnUrls } from '$lib/billing-path';
import { appOrigin } from '$lib/server/app-url';
import { editorCount } from '$lib/server/team/seat-billing';
import type { Db } from '$lib/server/db/client';

import { CHECKOUT_LINK, statusForFailure } from '@feega/api-contracts';

const PLANS = [{ credits: PLAN.credits, label: `€${PLAN.price} / editor / month` }];

const refuse = (error: string, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, { status: statusForFailure(CHECKOUT_LINK, error) });

export const POST: RequestHandler = async ({ request, params, url }) => {
  const { supabase, user, apiKey, error } = await authenticate(request);
  if (error) return error;

  const { brand, error: brandError } = await loadBrandForUser(supabase, params.slug, apiKey);
  if (brandError) return brandError;

  const readOnly = checkApiKeyWriteAccess(apiKey);
  if (readOnly) return readOnly;

  if (!(await billingGrantsReady(supabase))) {
    return refuse('purchases_not_ready');
  }

  const parsed = CHECKOUT_LINK.input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
  }

  const appBillingUrl = `${appOrigin(url)}${BILLING_PATH}`;

  if (!(await isOrgOwner(supabase, brand.org_id, user.id))) {
    return refuse('not_org_owner');
  }

  const wanted = parsed.data.credits;
  if (wanted != null && wanted !== PLAN.credits) {
    return refuse('unknown_plan', { plans: PLANS });
  }

  const billing = await orgBillingForBrand(supabase, { slug: params.slug });
  if (!billing) {
    return refuse('no_org_billing');
  }
  if (billing.subscriptionId) {
    return refuse('already_subscribed', { app_billing_url: appBillingUrl });
  }

  try {
    const { subscriptionPriceId, ensureOrgCustomer, createSubscriptionCheckout } = await import('$lib/server/stripe');
    const priceId = await subscriptionPriceId();
    if (!priceId) {
      return refuse('subscriptions_not_configured', { app_billing_url: appBillingUrl });
    }
    const customerId = await ensureOrgCustomer({
      id: billing.orgId,
      name: billing.orgName,
      stripe_customer_id: billing.customerId
    });
    const checkoutUrl = await createSubscriptionCheckout({
      customerId,
      orgId: billing.orgId,
      priceId,
      credits: PLAN.credits,
      quantity: await editorCount(supabase as unknown as Db, billing.orgId),
      ...checkoutReturnUrls(appBillingUrl)
    });
    return json({ ok: true, url: checkoutUrl, plans: PLANS });
  } catch (e) {
    return refuse('stripe_unavailable', { message: e instanceof Error ? e.message : undefined });
  }
};
