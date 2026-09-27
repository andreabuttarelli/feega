# Add bar: products/feed addable again, iframe hidden

`newNodeRow` creates `products` with `url: ''` and `social_account_feed` with
`handle: ''`; `node-data.ts` required `url()`/`min(1)`, so `create` refused
both. Empty now means "not configured": the schema accepts `''`, and the sync
actions already refuse an empty url/handle before calling a provider.

`iframe` is not ready: `CANVAS_ADD_BAR` (in `addable.ts`) drives the bar and
number shortcuts; `CANVAS_ADDABLE` still validates existing iframe nodes.

Guard: `new-node-row.test.ts` validates `newNodeRow` for every bar entry.
