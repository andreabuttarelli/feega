# Render failures say why

Production, last 30 days, external users: every browser render (3) expired after 2 h with
"timed out — the request that ran it never came back". None had been opened: the MCP agent
got a `render_url` and nobody visited it. The link itself dies at 30 min, so the run sat
`running` for 90 min with nothing able to finish it, then lied about the cause.

- `expireStuckRuns`: a `browser-render:` run whose link expired unclaimed is expired at once
  with `render link was never opened`. Opened links keep the 2 h deadline.
- `submitAndTrackVideoRender`: `provider refused` now carries the provider's message (it was
  only logged). Two of seven AI video failures had no readable cause.

Discarded: auto-falling back to a farm render when a link goes unopened — it spends credits
the user never approved.
