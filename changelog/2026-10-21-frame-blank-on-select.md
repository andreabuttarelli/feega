# A big frame no longer goes blank when an element inside it is selected

Selecting an element puts its frame in `NodeChrome.Editing`, whose dashed ring was built as one
overlay `PathItem` per dash. A landing page (1440×4734) made ~1500 items with the same clip id;
past that the core compositor stopped drawing the canvas: the frame went black (stand-in) or
transparent, depending on what was retained. Small frames (≤ ~770 dashes) were fine, which is why
`canvas-frames.spec.ts` stayed green.

Fix: the editing ring is one item holding every dash as a contour (`chrome.ts`). Same pixels.

Not done: the compositor's own limit on overlay items is still unknown and unguarded
(`packages/gpu-core`); any other chrome that emits one item per piece can hit it again.

Test: `canvas-frames.spec.ts` seeds a 1440×4734 landing (`fixtures/landing-frame-doc.ts`), zooms
to 0.55, clicks the nav and a card, and checks the drawn page keeps its box and dark-pixel ratio.

On dev before this change, 5 `canvas-frame-*` specs already fail (child-handles, edits-reload,
free-children, text-typing, tools rotation 0); unrelated, not touched here.
