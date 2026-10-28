# Social feed sync bills the org

`syncNode` (Sync button on a `social_account_feed` node, and the agent's `sync_node` op) ran
ScrapeCreators with no billing scope on a brandless project: `logAiCall` found no org, wrote no
`ai_calls` row, and the cost was unbilled. `syncNode` now runs inside `withOrgContext`.

`requireBrandContext` no longer logs "AI call without brand context" under an org scope: an org
payer is a valid scope, the log was a false alarm.

The scrape is not automatic: only the Sync button or the agent triggers it.
