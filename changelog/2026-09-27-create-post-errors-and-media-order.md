# The composer swallowed failures and ignored the media order you set

Two defects in `create-post/+page.svelte` → `?/create_post` → `createPostFromNodes` →
`promoteNodesToPost`.

## A failed save showed nothing

`use:enhance` called `update()` and stopped there. A `fail(400/422, {error})` result
updated `form`, but nothing read `result.type === 'error'` (a thrown exception — a
500, or the browser fetch itself failing), and the submit button never reset its
busy label if the request never resolved into a `success`/`failure` result.

`submitErrorFor` (`create-post-composer.ts`) is the single place that turns a
`use:enhance` outcome into copy: `'server'` for a thrown exception, `'network'` for
a request that never reached the server, an object with `.error` for a `fail()`
result (mapped through the existing `errorCopyFor` table), `null` for anything else.
The component tracks `submitOutcome`/`submitting` as local `$state`, resets both in
the `use:enhance` callback regardless of outcome, and renders the banner next to the
footer buttons. Caption/media/account selections are untouched on failure — they
were already `$state`, never reset by a failed submit.

## Reordering in the composer was thrown away

`promoteNodesToPost` always sorted nodes by canvas position
(top→bottom, left→right) to build `posts.media`, so the up/down arrows in the
composer changed what you saw on screen and nothing else — the saved post kept the
canvas order.

`promoteNodesToPost` now takes an optional `mediaOrder: string[]`. When present, the
media entries are sorted by that list (`byMediaOrder`); nodes not media (captions,
references) are unaffected, still resolved and ordered by canvas position for
`post_sources`. Without `mediaOrder` the old canvas-position fallback still applies —
callers that don't reorder (the API route `/api/v1/org/posts`) see no change.

The canvas `create_post` form action reads a new `media_order_node_id[]` field,
separate from `node_id[]` (which also carries caption/reference nodes) and threads
it through `createPostFromNodes` to `promoteNodesToPost`.

## Test

`create-post-composer.test.ts` — `submitErrorFor` against a `fail()` result (known
and unmapped error codes), a thrown-exception outcome, a network outcome, a success
outcome, and no outcome yet.

`post-from-nodes.test.ts` — `promoteNodesToPost` given `nodeIds` in one order and
`mediaOrder` in a different one persists the `mediaOrder` order; an id in
`mediaOrder` that has no media asset is skipped rather than crashing; without
`mediaOrder` the canvas-position fallback still holds (existing test, unchanged).

`create-post-from-nodes.test.ts` — a new suite wires the real `promoteNodesToPost`,
`findBrand`, `listBrandAccounts` and `listNodesByIds` against
`src/lib/testkit/supabase.ts` (no mocks of the function under test) and asserts the
row written to the in-memory `posts` table keeps the composer's order even though
canvas position would produce the opposite one.

Verified in the browser against the local dev server (Playwright/chromium, a
disposable org/project/brand/nodes seeded and torn down): a forced
`brand_and_nodes_required` failure showed the Italian banner text next to the
buttons with the media list and caption still filled in and the "Save as draft"
button back to its resting label; moving the bottom image node above the top one
with the composer's arrow button and saving produced a `posts` row whose `media`
array put that node first.
