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
item list per layer. The hidden subtree is now removed in one pass before the splices.
