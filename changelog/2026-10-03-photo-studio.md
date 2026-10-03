# Photo studio (catalogue batch photos), MVP

**Why.** E-commerce teams need the same product shot many times — products × models × scenes ×
shots — consistently. The canvas loop could iterate one node; nothing grouped a catalogue job,
priced it up front, tracked each photo, or let you approve and download.

**What.**
- `/p/[projectId]/studio` (rail entry "Photo studio"): pick products from the project's products
  nodes, synthetic models, environment presets (`src/lib/studio/environments.ts`), optional
  gallery style references (the same `NodeReferences` picker image nodes use), shots
  (`shots.ts`), variations and model. Estimate → preview 3 on the cheapest model → run.
- `/p/[projectId]/studio/[batchId]`: live grid (realtime on `product_batch_items` + poll
  fallback), cancel, retry failed, regenerate one, approve/reject, zip of approved, open canvas.
- Tables `product_batches` / `product_batch_items` (migration `20261003120000`), RLS by org.
- Every batch materialises a real canvas: a copied products node iterated (`iterate` edge) into
  one image node per environment × shot × model cell. Each photo is `runGenNode` with
  `iterateSelection` = that product: moderation, AI marking, provider purge and asset storage
  are the engine's, not a copy.
- Drain: `drainStudio` — K=4 per org, never two items on the same cell node at once (optimistic
  `version` would conflict); transient errors retry twice (30s, 60s), moderation refusals go to
  `blocked` and never retry. Driven by the open page (`?/drain`) and by `canvas/runs/tick`.

**Decisions.**
- Casting is synthetic-only: `castingVerdict` refuses catalogue talents (the likeness guard
  already classifies them as real people), photo-built influencers, and apparent age < 21 or
  unknown. Kids' products (keyword table on title/type/tags) get packshot/detail only.
- Style references require a "no people" attestation: `reference_images` has no people flag and
  the global gallery does contain portraits. Prompt also forbids copying people from them.
  References beyond the model's `maxRefs` (after product photo and model views) are dropped and
  reported.
- Pricing: the model's catalogue `unitCredits` (`creditsForRun`), checked against the org
  balance for the whole batch before anything is queued. Max 200 per batch.
- Product order inside the copied node is fixed by inserting one row at a time.

**Discarded.** Extending `drainLoopQueue` (sequential, one output list, no per-item approval);
one node per photo (200 nodes and every run re-resolving the whole canvas).

**Known gaps (v2).** Reference ordering product → model → style is not enforced by the engine
(edge order is by id); types not regenerated (repo uses an untyped client — `db:types` needs a
token); no store write-back; no people detector on references.

**Found while verifying (fixed here).** A products node wired into an image node never sent the
store photo: the image branch put the first upstream image in `baseMediaId` (own storage paths
only) → `source_not_found`. External first references now go in `referenceImageUrls`. The studio
offers only models with a spec in `image-models.ts`: synced-only and `wiro/*` models failed.

**Verified** on a real run (dev server, real Supabase/OpenRouter): 2 products × white e-com ×
packshot on Seedream 5 Lite with a gallery style reference, both done, approve, zip (200), canvas
opens with the products node wired into the cell; another org's user reads 0 rows and its insert
is refused (42501).
