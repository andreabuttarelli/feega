# Canvas: edits on component instances take the fast patch

On the user's canvas copy (edit bench `PROBE_PLACE`), nudge, nudge-leaf and colour patched 0/10:
every edit rebuilt the frame (~105 ms desktop). Decline marks showed two reasons.

- **Edit inside a component** (`many:comps`): the edit changes only `doc.comps`, so `onlyClip`
  found no changed top clip. `instanceOfEdit` now finds the single top `Precomp` instance showing an
  edited comp and redraws its subtree through `subtreeRedrawn`. Two or more instances of the same
  comp still rebuild.
- **Nudging a frame that holds an instance** (`replanned:instance`): the slide refused any item
  whose instance host was slid. Instance items now take their host's slide; inside the host's own
  group they are not slid twice (`Ctx.within`).

Copy, desktop p50: nudge 119 → 12 ms, nudge-leaf 106 → 19, colour 101 → 10, hide 70 → 13; all
10/10 patched; 4× p50 27–51 ms. Landings 4× interleaved (fix, dev, fix) within noise.

Not done: a bleed mismatch (`paintBleed` of the shown doc ≠ the list's bleed) still declines some
colour and hide edits on the copy; a guess that strokes inside components cause it did not
reproduce in a test.
