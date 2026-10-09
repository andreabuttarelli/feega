# One part of the UI at a time

Product scenes held a whole rebuilt screen for seconds: every field, button and card at once, too
small to read. The rule now matches the title-card one: a product act is a sequence of UI beats,
one element per beat, isolated and zoomed.

- `UI_FOCUS_RULE` (`style.ts`) in launch film, apple minimal and UI morph rules; the prompt's
  script step and `write_script` say product acts are written as UI beats.
- `focus_ui` tool → `focusUi` (`ui-focus.ts`): keyframes scale/x/y so an anchor box lands centred
  at `fill` of the frame on `Ease.Standard`; `isolate: part` adds a rect mask keyframed to the part.
  Chained calls start from the previous state, so beats zoom from part to part. Scale is capped by
  the transform range (offset ±2 frames, scale 10).
- Anchors: prompt box gains `progress` and `done`; generated result `picture` and `copy`;
  `recreate_ui` names every block (`heading-0`, `stat-0`, `card-0`…; `input-N` and `button` kept).
- Gate `ui-overload` (Warning, launch film + apple minimal): a UI clip with more than two anchors
  visible and unmasked for over 1.5 s, or more than two UI pieces on screen at once. Anchorless kit
  pieces (stat cards, payouts…) are only caught by the second rule.
- Discarded: an `add_ui` `part` prop rendering one element in the kit JS — it would fork every
  piece; masking plus framing isolates any anchored part of any piece, recreated ones included.
