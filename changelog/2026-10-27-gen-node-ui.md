# Generation nodes, model picker and selection bar redesign

**Before.** Text, image and video nodes were square boxes with a bordered prompt, a bare
"Save as skill" link on its own row and a white/black Generate button. The GPU-drawn card
(`core/gen-card.ts`) and the DOM node (`GenNode.svelte`) disagreed once selected: the skill link
pushed the prompt up.

**Now.**

- Cards use the radius scale: card `lg`, inset result well, prompt, chips and buttons `md`, run
  history pills `full`. The user dropped the radius-0 rule for these nodes.
- Generate is the accent button with the estimate; "Save as skill" sits left on the same row,
  so DOM and GPU card share one geometry (`gen-card.test.ts` pins it).
- Running: accent ring, shimmer on the well, round dots. Failed: reason and "Try again".
- Picker: maker / model section labels, search field with icon, route tiers shown as `$` of
  `$$$`.
- Double-clicking an image or video output (or the new tab button next to download) opens the
  full file through `/p/:p/c/:c/assets/:id`, which re-signs on every request (24h signed URL
  behind it). Text fields keep their own double-click.

**Second pass (user feedback).**

- Media-first: image/video nodes open at their aspect ratio (1:1, 16:9); the output fills the
  card and prompt, references and Generate float in one bar over it (`gen-card.ts` `bar()` and
  `GenNode.svelte` share the geometry). A finished output shows only the media until selected.
  The focused prompt takes the full bar width.
- Generate is a round arrow-up button; the price is plain text from one formatter,
  `formatPrice` ($0.02, < $0.01), in node, GPU card and selection bar.
- Selection bar: row 1 generation controls, row 2 the three top actions ranked in
  `toolbarSlots` (`selection-actions.ts`), the rest plus delete in the overflow menu.
- Rounded selection and running rings, handles centred on the ring, round ports, sm-radius
  segmented controls, visible menu hover, inline "cheapest" pill, no "AI-generated" label.
- Failed runs: selectable, copyable, expandable error. History: thumbnail strip under the node.
- Local mode ticks provider reconcilers itself (`local-ticker.ts`); Kie jobs used to stay
  running forever because only the cloud cron advanced them.

**Not done.** The selection ring stays square; the settings popover keeps its old style;
reference thumbnails were not seen with real data (no media in the local project).
