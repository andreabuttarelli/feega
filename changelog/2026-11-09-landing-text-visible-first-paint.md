# Landing text visible from first paint

The live-agents homepage (#1848) hid every element in CSS until an agent "built" it, and typed text
in from empty. That delayed LCP (largest contentful paint) on the hero headline and kept copy out of
the first paint. Agent overlay boxes and the avatar stack were also positioned with `left`/`top`,
which Chrome counted as layout shift (CLS 0.15–0.40).

Now:

- Text is never hidden or retyped. A default text row in `ELEMENT_RULES` (`TEXT_SELECTOR`,
  `BuildMode.Style`) makes agents only style it on arrival: select, colour, font or tracking, then
  settle back. The wordmark row lost its retype beat.
- Only non-text visuals (`*` row, `BuildMode.Place`) can be placed, and only when they start below
  the fold. JS hides them with inline opacity at mount and reveals them with a `scale` transform.
  Nothing is hidden by CSS, so no-JS clients and crawlers see the full page. The `BUILD_HEAD`
  snippet and its 4 s fallback are gone.
- Font and tracking swaps lock the element's height, so neighbours never move. Overlay boxes, menus
  and avatar faces move by `transform`.

Measured headless on desktop and mobile while scrolling the whole page: CLS 0.000 / 0.007, all text
at its designed opacity on first paint, with and without JS.

Removed: typing frames, typo simulation, caret.
