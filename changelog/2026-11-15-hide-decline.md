# Canvas: a section hide no longer falls back to relaying out the page

After #2199 every hide on landings took ~305 ms. Decline marks (`patch:decline:<reason>`, traced
only under `__editTrace`) on the landings fixture: hiding a direct child of a page root declined
with `too-many` in 10 of 36 cases, and the fallback relaid out the page with real fonts.

- The redraw cap counted the hidden clip's own subtree, which is only removed, never drawn. It
  now counts clips that are still shown.
- Budget strikes are kept per layer and per edit kind (`editKindOf`): a fast show of a layer no
  longer clears the strikes of a slow hide of the same layer.
- Fixture checks: resize 511/527, hide 524/530, show 509/530 patched, 0 mismatches; parity 0.

## The real 300 ms: splicing hidden layers one by one

With the cap fixed hides still took ~300 ms. Block marks inside the redraw (`patch:plan`, `mini`,
`draw`, `splice`, `gaps`, `bleed`, traced) showed `patch:splice` at ~300 ms on every hide and
~2 ms on shows: each hidden layer of the section was spliced out on its own, copying the whole
item list per layer, and each layer after the section was slid the same way (a landing page has
hundreds after a top section). The hidden subtree is now removed and the slid layers shifted in
one pass each.

## The rest: putting redrawn layers back one by one

Finer marks (`patch:splice:redraw`) showed the remaining ~300 ms on toggles that re-show a
section: each of 27 re-shown layers searched the list once per later clip in draw order, and each
redrawn ancestor was spliced with its own scan and copy. Both now run in one walk. Node tests count
`startsWith` calls on a 20-shell fixture: 152 601 → 1 681 on unhide, 4 420 → 400 on hide.

| hide p50/p95 (ms) | desktop | 4x CPU |
|---|---|---|
| v16 | 103 / – | 379 / 1439 |
| v19 (dev) | 313 / – | 1290 / – |
| this PR | 37 / 75 | 139 / 224 |
