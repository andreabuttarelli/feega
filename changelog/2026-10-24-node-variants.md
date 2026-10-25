# Variants on image and video nodes

**Before:** one Generate click made one result. Several options meant clicking again and
overwriting, or setting up a loop with its own output list.

**Now:** next to Generate, a Variants picker (1, 2, 4, 8; video up to 4) and a destination.
"Separate nodes" creates N new nodes laid out right of the source, wired from the same inputs,
one run each. "Node history" runs N times on the same node; every result lands in `node_runs`,
a grid in the selection bar picks the current one. The Generate button shows variants x the
price of one run. The choice is remembered per user in `localStorage` and only applies to nodes
that never chose.

**Decisions:**
- `run_node_generation` / `run_node` / the Generate endpoint take `variants` and `into`. One
  entry point, `runGeneration` in `server/canvas/variants.ts`; `variants: 1` is the plain run.
- No provider in the repo returns N images in one call (`count` loops), so variants are
  parallel `runGenNode` calls, the same engine and gates as one click. Allow-list, spend caps and
  whole-batch credits are checked once before anything is created or spent; each run re-checks.
  Caps are read per run at start: a batch already in flight can pass a cap by its own size.
- History mode: runs share one node. The marking write is a merge patch instead of a version
  check (`StartRun.variants.sharesNode`); `running` stays true until the last sibling of the
  group lands (`variantGroup` / `variantSource` in `node_runs.params`), also for queued videos.
- Cancel all reuses `cancel_node_loop` (REST DELETE `/loop`, UI `cancel_loop`): it fails the
  pending runs of the batch. An image already rendering finishes and keeps its result. No new
  tool, only the descriptions of two changed (pins updated on purpose).
- `maxVariants` on `ModelChoice` caps per model; nothing fills it yet, medium caps apply.
- Not done: video variants are not tested in a browser; no provider-native `n`.
- e2e mock (`mock-images.ts`) now answers `/chat/completions` and `/responses` with a safe
  moderation verdict, otherwise a canvas run is refused `moderation_unavailable`.
