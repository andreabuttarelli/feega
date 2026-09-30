# Refund policy with a usage threshold

Before: `TERMS.md` had `[REFUND POLICY — to be defined]` and an open
`[REFUNDED / FORFEITED]` for top-ups on termination; Checkout collected no
consent, so the withdrawal waiver of art. 16(m) had nothing behind it.

Now:

- `REFUND.md`: 14 days from a first plan purchase or a top-up, refundable
  while credits used from it are ≤ min(10% of granted, 5 credits); refund =
  paid − used (€1 each) − Stripe processing fee. Renewals: only within 48 h
  and untouched. Welcome credits never. TERMS §5/§13/§18 summarise and link.
- `src/lib/billing/refund-policy.ts`: one rule table per `PurchaseKind`
  (window, max share, max credits). `refundEligibility` is pure.
- Credits used from a purchase (`creditsUsedFrom`): total debits are applied
  to grants in the same order as `org_credits_at_risk` — expiry ascending,
  non-expiring last, then `created_at`. The ledger does not link a debit to
  a grant, so this is a derivation, not a record. Expired grants still count
  in the order, which can overstate use of a later purchase.
- First subscription vs renewal: a `subscription_renewal` grant is a renewal
  when an earlier one exists for the org — a resubscribe after cancelling
  counts as a renewal (48 h rule).
- `refund-status.ts` reads `credit_ledger` (RLS client) and takes the fee
  through a port; `stripe.ts#paymentProcessingFee` reads it from the balance
  transaction (checkout → payment intent; invoice → invoice payments).
- Billing page: refund line for the latest purchase + policy link + mailto.
  Refunds are not issued automatically.
- Checkout (both modes): `consent_collection.terms_of_service = 'required'`
  and custom text for the express request / withdrawal acknowledgment. Needs
  the Terms URL set in Stripe Dashboard → Settings → Public details, or
  Checkout rejects the session.
