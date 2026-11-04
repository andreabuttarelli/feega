# UI components land faithfully, animated and inside frames

The registry-component prototype (#1823) drew components close to the original but with visible losses. Fixed:

- **Placeholders centred**: field text was captured as a one-line hug text, and a single child with equal padding got centred. Field text is now a fixed-width line, so it stretches across its field (`page-tree.ts` `fieldText`).
- **Inline underline lost**: text decoration was read only for the base style of a text, never per run. It is now part of every run's style, carried through `rest-message` and `scene` runs as `underline`/`strike`.
- **Title bound to "Text muted"**: the heaviest text colour was named Text. In a form the grey placeholders outweigh the title. `Text` and `Text muted` are now ordered by contrast against `Background` (`page-tokens.ts` `CONTRAST_PAIRS`).
- **"Localhost/…" variables**: the collection took the preview host. `PageShape.site` names it; `insert_component` passes library and component (`Magic UI shimmer-button-demo`, `collectionOf` in `registry-item.ts`). One collection per library was tried first: a second component of the same library then merged into the first one's collection and its bound colours took the first one's values (the shimmer button exported blue with dark text while the canvas, reading the components page, showed it black).
- **Fade lost on masked wrappers**: a wrapper whose only look was a gradient mask counted as bare and was flattened away. A mask now counts as a look.
- **Frozen animations**: CSS animations are sampled in the page (12 points over one cycle, relative to where the page was read) into `RestNode.motion`, then into transform keyframes (`captured-motion.ts`); a doc with keyframes stops being a still.
- **New frame only**: `insert_component` takes `frameId`/`parentId`. The component subtree is transplanted into the target doc with its comps, variables and styles in one revision; the frame it was read into is removed. `moveElement` was not used: it moves one clip without its children.

Discarded: reading marquee copies that sit outside the clip by widening it by the animation's travel. The copies came in partially, without auto layout, and drew on top of each other; the marquee now slides its first copy only.
