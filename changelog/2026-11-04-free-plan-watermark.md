# Free plan exports carry a "Made with Feega" mark

Plan = `orgs.stripe_subscription_id` (no plan column exists; `credits.ts` always reads
`plan: null`). `billingTierOf` (moved out of `uncensored-access.ts`, which now imports it)
maps to `BillingTier`; `EXPORT_MARK` in `export-watermark.ts` is the one table that says free
is `Watermarked` and paid is `Clean`.

The mark is `withWatermark(doc)` in motion-core: a transient top track with one Text clip,
bottom-right, 0.6 opacity, sized from the short side. It is added to a copy of the doc at
export time, never saved, so every engine (HTML compositor, GPU core, vector) draws it without
a change to any of them. We rejected a compositor-only flag: the GPU export path does not go
through `composeHtml`.

Server decides, client trusts nothing: `watermarked(db, orgId, doc)` is called in
`startFarmRender`, `exportStill`, `linkPayload` (browser render link), `selectionPorts`
(PNG/SVG/PDF) and both batch row builders. The editor session carries `exportMark` for the
in-app Export dialog, which exports client-side.

Not covered: element-cropped selection exports (the crop excludes the corner), Lottie, the
hosted interactive embed, `export_code_frame` and the legacy /app/compose export dialog.
