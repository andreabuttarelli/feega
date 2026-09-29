import { describe, expect, it } from 'vitest';
import { checkoutReturnUrls, CheckoutOutcome, checkoutOutcomeOf } from './billing-path';

describe('checkoutReturnUrls', () => {
  const billing = 'https://oh.feega.app/p/proj_1/settings/billing';

  it('brings a paid checkout back to the billing page with its session id', () => {
    expect(checkoutReturnUrls(billing).successUrl).toBe(
      `${billing}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    );
  });

  it('brings an abandoned checkout back to the billing page', () => {
    expect(checkoutReturnUrls(billing).cancelUrl).toBe(`${billing}?checkout=canceled`);
  });
});

describe('checkoutOutcomeOf', () => {
  const at = (qs: string) => new URL(`https://oh.feega.app/p/x/settings/billing${qs}`);

  it('is paid only with a session id', () => {
    expect(checkoutOutcomeOf(at('?checkout=success&session_id=cs_1'))).toBe(CheckoutOutcome.Paid);
    expect(checkoutOutcomeOf(at('?checkout=success'))).toBe(CheckoutOutcome.None);
  });

  it('reads a cancel and ignores everything else', () => {
    expect(checkoutOutcomeOf(at('?checkout=canceled'))).toBe(CheckoutOutcome.Canceled);
    expect(checkoutOutcomeOf(at(''))).toBe(CheckoutOutcome.None);
  });
});
