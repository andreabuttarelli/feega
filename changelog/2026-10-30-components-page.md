# Components page

URL/code import drew all mains into one page-sized "Components" frame (16k px, mostly empty,
slow). Now each main or variant set gets its own frame, sized to content, on a project canvas
named `Components` (created on first use, `components-page.ts`). `⌥⌘K` moves the hand-made main
there too and leaves a linked instance (user's choice, Framer style; ADR 0031).

- `comp-frame.ts`: `reframed` rescales comps by pixels between frame sizes; `linked-mains.ts`
  anchors the followed main to the instance copy's top-left; `canvas-components.ts` rescales on
  insert. This is what makes content-sized homes possible.
- `component-sheet.ts`: `componentPages` replaces `componentSheet`; `UrlPlan` carries `sets` and
  per-comp `homes`.
- `component-set.ts`: set detection and the "+" that appends a variant and widens the frame;
  `ComponentSetOutline.svelte` draws the dashed outline, on the Components page only.
- New canvas op / page action `home_components` / `homeComponents`.
- Old imports untouched. Agent `component create` does not home by itself; it calls
  `home_components`.
