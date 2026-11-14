# Stripe Checkout tied to the user's email

`ensureOrgCustomer` created the org's Stripe customer with only `name` and `org_id`, so Checkout
had no email to prefill and receipts had no address.

- It now takes the acting user's email (owner who clicks Subscribe or Top-up) and creates the
  customer with `email`, `name`, `metadata { org_id, app: 'feega' }`.
- An existing customer without email gets it set at checkout time; an existing email is never
  overwritten.
- Threaded from `settings-actions.ts` (credits page actions) and both
  `/api/v1/brands/:slug/billing/checkout` routes.
- `scripts/stripe-backfill-customer-email.ts` fills old customers; dry run unless `--apply`.
- "Feega credits" and "Feega Cloud" capitalised in the Checkout line item and local-mode messages.
- `customer_update` not added: no tax collection is enabled.
