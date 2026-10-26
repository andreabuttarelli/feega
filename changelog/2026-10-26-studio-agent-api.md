# Photo studio batches over the API, CLI and MCP

A person prices and starts a Photo studio batch in the app; an agent could only follow one. `POST /api/v1/studio/quote` returns count, credits and a stateless `quoteId` (sha256 of the selection plus per-image price and count). `POST /api/v1/studio/start` requires that id, recomputes the quote, answers 409 when selection or price moved, passes the org credit gate, then calls `startBatch`. The quote summary moved out of the page action into `studio-quote.ts` so page and API share it (separate commit).

CLI `feega studio quote|start|status`, MCP `studio_quote`, `studio_start`, `studio_status`, parity rows for the three page actions. Left out: the batch page actions (run, more, cancel, retry, regenerate, approve, reject) are reachable over REST but have no MCP tool yet.
