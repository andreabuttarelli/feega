# Higgsfield joins as a primary provider

Third adapter behind `TaskProvider` (ADR 0012). `higgsfield.ts` submits to the model path with
`Authorization: Key <id>:<secret>` and an `Idempotency-Key` equal to the `node_runs` id (the docs'
fix for ambiguous timeouts), polls `/requests/{id}/status`, and cancels queued requests with
`/requests/{id}/cancel` — the first adapter that implements `cancel`.

The status carries no cost, so price comes from `POST /estimate/<path>` at sync time, one call per
priced variant (resolution for Soul, duration for video). A model with any unpriced variant is not
synced: we never offer a model we cannot quote. A finished task bills that quote; failed and
`nsfw` requests are not charged by Higgsfield and bill nothing here.

Catalogue (`higgsfield-catalogue.ts`): Soul (image), Kling 2.5 Turbo Pro and Hailuo 2.3 (video),
text-to-video and image-to-video as separate picker entries, because they are separate endpoints
with a required `image_url` on the second. Taken from Higgsfield's `openapi.json`; its llms.txt
says that file is not the full catalogue, so more models are a row each.

Env: `HIGGSFIELD_API_KEY_ID`, `HIGGSFIELD_API_KEY_SECRET` (optional `HIGGSFIELD_BASE_URL`).
Verified only against doc-shaped fixtures; `npm run eval:provider-smoke -- --spend --only=higgsfield`
checks the real API and refuses to submit if `/estimate` is above $0.15.
