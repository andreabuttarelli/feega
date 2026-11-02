# The Stack inspector reads like Figma's auto layout panel

User spec (reference: Figma UI3 auto layout). Section logic only; shared primitives are being
restyled in parallel.

- `SECTION_ORDER` puts **Alignment** before **Layout** for every clip, and adds
  **Selection colours** (`Section.Colours`) after Effects: a container lists the colours of
  itself and its descendants (`clipColours` / `recolourClip` in `selection-colours.ts`, built
  on the existing `selectionColours` / `recolour`).
- A Stack's W / H leave **Layout** (`STACKED_KEYS`) and live in **Stack**, side by side with
  their mode inline. Hug and Fill show the resolved pixels (`laidClip`), not the word `hug`.
- **Stack** section: direction + unwrap (the Remove stack header action moved inline), 3×3 grid
  beside the gap, gap mode `px | Auto` (Auto = `justify: space-between`; the separate
  space-between button is gone), padding H / V with a per-side toggle, a Clip content checkbox.
  Stretch, baseline, space around / evenly, First on top, Strokes included and min / max moved
  behind the settings toggle (`auto-layout-advanced`), as in Figma.
- **Appearance** (opacity + eye, radius, blend) came with the UI3 restyle (#1713); clip content
  stays there only for non-Stack containers (`clipsOwnContent`).
- Header: **Create component** is inline (`clip-bar.ts` placement table). No variant action
  exists to show.
- **Export** section (`ExportSection.svelte`) under the inspector calls the existing
  `exportPicks`.

Removed: the CSS-shorthand padding field and `padding-text.ts` (no other caller). The e2e spec
that typed `8, 16` now sets H and V and splits per side.

Tests: `stack-inspector-layout.test.ts` (order, W/H placement, unwrap, gap Auto, padding,
checkbox, appearance order, colours), `clip-bar.test.ts`, updated `stack-section.test.ts`.
