# Turn cap on the gateway bill

The 5-case eval showed fixer turns at $1.3-3.4 against a $0.75 share.
The cap compared `spentUsd` from the rate card; the gateway bill was
higher. The motion turn's rounds now run inside `billingScope(orgId)`
(`ai-log.ts`), and `overBudget` and the reported `costUsd` use
`max(estimate, billed)` for the rounds plus the side calls (critic,
copywriter, sources).
