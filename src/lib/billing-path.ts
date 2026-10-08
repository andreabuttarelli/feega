export const BILLING_PATH = '/app/credits';

export enum CheckoutOutcome {
  None = 'none',
  Paid = 'paid',
  Canceled = 'canceled'
}

const OUTCOME_PARAM = 'checkout';
const SESSION_PARAM = 'session_id';
const STRIPE_SESSION_PLACEHOLDER = '{CHECKOUT_SESSION_ID}';

export function checkoutReturnUrls(billingUrl: string): { successUrl: string; cancelUrl: string } {
  return {
    successUrl: `${billingUrl}?${OUTCOME_PARAM}=success&${SESSION_PARAM}=${STRIPE_SESSION_PLACEHOLDER}`,
    cancelUrl: `${billingUrl}?${OUTCOME_PARAM}=canceled`
  };
}

export function checkoutOutcomeOf(url: URL): CheckoutOutcome {
  const outcome = url.searchParams.get(OUTCOME_PARAM);
  if (outcome === 'canceled') {
    return CheckoutOutcome.Canceled;
  }
  if (outcome === 'success' && url.searchParams.get(SESSION_PARAM)) {
    return CheckoutOutcome.Paid;
  }
  return CheckoutOutcome.None;
}
