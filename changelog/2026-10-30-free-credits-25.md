# Free tier: 25 credits a month, no welcome grant

User decision. `FREE_CREDITS` 400 → 25. The 100-credit welcome grant (14-day expiry) is gone:
`WELCOME_CREDITS`, `WELCOME_CREDITS_EXPIRY_DAYS`, `grantWelcomeCredits` and the unique-violation
code it swallowed are deleted, and `createFirstOrg` no longer touches `credit_ledger`. Chosen over
a zero-amount grant: no rows that mean nothing.

Existing grants stay in the DB and keep their expiry. The eval `gen-node` no longer tops up the
org; it runs on the free quota.

Copy: pricing and docs credit tables read `FREE_CREDITS`, so they follow. The terms (`TERMS.md`,
`landing/src/lib/site/legal/terms.html`) still describe welcome credits, which remain true for
orgs created before this change.
