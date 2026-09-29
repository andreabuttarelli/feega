# Feega customer portal configuration

The Stripe account is shared with other products, so the portal uses a
feega-only configuration (`bpc_1UL2Aa…`, not the account default): switch
between the six EUR plans with proration, cancel at period end, invoices,
payment method, billing details. `createBillingPortalSession` passes it via
`STRIPE_PORTAL_CONFIGURATION` (set on Vercel production).
