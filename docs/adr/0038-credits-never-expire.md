# 0038 — Credits never expire

Status: accepted 2026-11-12. Supersedes the expiry rule in ADR 0017.

## Context

ADR 0017 had subscription grants expire at the period end. `org_credit_balance` dropped expired
grants but kept every debit, so a subscriber who spent a month's grant lost the same amount again
at renewal. The owner also moved billing to one plan (€9 per editor per month, 500 credits) and
top-ups.

## Decision

- No credit expires: monthly grants, top-ups, welcome and refund grants stay until spent.
- `org_credit_balance` sums every grant minus every debit
  (`20261112_credits_never_expire.sql`). Renewal grants are written without `expires_at`, and
  their amount is `metadata.credits × invoice line quantity`.
- `org_credits_at_risk` is dropped; nothing is at risk.
- Store grants may still carry `expires_at`; the balance ignores it.

## Consequences

Unspent monthly credits carry over. The pglite harness `npm run test:credit-expiry` runs the real
SQL and fails if a spent grant again eats a renewal.
