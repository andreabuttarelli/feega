# Vercel deploys only main

In 19 days Vercel created ~3,700 preview deployments for agent branches
(`feega` and `feega-5ksn`), each cloned and then cancelled by
`scripts/vercel-ignore.sh`: ~380 build minutes paid to skip. `git.deploymentEnabled`
now stops Vercel from creating a deployment at all for any branch but `main`
(root app, `cli/mcp`, `landing`). The `[preview]` commit opt-in no longer
creates previews; `vercel deploy` from the CLI still does.
