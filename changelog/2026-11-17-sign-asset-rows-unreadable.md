# Frames survive an unreadable asset batch

Production (deploy of `bfa4a1225`, 2026-11-17 14:15 UTC) answered 500 on
every motion source of one canvas: `signAssetPaths: the asset rows are
unreadable`. That build predates `eb8474f56` (batched `in()` filters,
on `dev` since 15/11, not released): `orgsHolding` sent the paths of up
to 200 assets in one GET URL, and the gateway refused it. The message has
no `(reason)` suffix, which `eb8474f56` added — so the deployed code is
the unbatched one. Shipping `dev` to `main` fixes the reported case.

This change closes what remained:

- `orgsHolding` no longer throws when one batch fails: the paths of that
  batch stay unsigned, the frame loads without those pictures, the reason
  is logged once. Before, one bad batch blanked every frame.
- `heldByOrg` (provider inputs) used the same unbatched `in()`; it now
  shares `batchesOf`. It still refuses on error: a run must not send a
  file it could not prove the org holds.
- Client: `cached()` turned a 500 into "no source" (204), indistinguishable
  from an unwritten head, and nothing asked again. A 5xx or network error
  now passes through, and `sourceReader` retries at 0.5 s, 2 s, 8 s.

Not done: a visible error state on a frame whose retries are exhausted.
