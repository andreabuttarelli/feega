# Publishing an embed inlined every asset of the project

`POST /api/v1/motion/<id>/embed` died on Vercel with "instance was killed because it ran out
of available memory" (500 `FUNCTION_INVOCATION_FAILED`). `embedSource` base64-inlined every
URL in `assetUrls` — the whole project library from `motionAssets` (up to 200, videos
included) — not just what the doc uses. The editor's "Publish embed" ran the same code in the
browser and crashed the tab.

- `inlinedInput` now inlines only `usedAssetUrls(doc, urls)` (ids found in tracks, comps,
  fonts, fields — the same rule as `referencedAssets`). Covers API, chat tool and editor.
- `publish_embed` over `/api/v1/motion/<id>/tools` (MCP/outside agents) answered "hosting
  embeds is not available here": `tool-run` never passed `embed`. It now does, via
  `embedAction`, shared with the chat turn.

Not done: a video the doc really uses is still inlined whole; a large one can still exceed
function memory. Hosting assets by URL instead of base64 is the follow-up.
