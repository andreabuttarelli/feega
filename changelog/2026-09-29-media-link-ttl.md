# get_media: user link lasts an hour

`full_url` (from `get_media`, `/api/v1/org/media`, and the `media` in
`run_node_generation` results) expired after 5 minutes: a link handed to
the user died before they opened it. The TTLs now live in one table,
`SIGNED_URL_TTL_S` in `src/lib/server/repos/asset-storage.ts`: `userLink`
3600s, `agentPreview` 300s (the agent fetches it at once), `canvas` 300s.
`signStoredFile`/`signStoredPreview` take the TTL explicitly. Tool
description and skill references state both lifetimes.
