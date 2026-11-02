# Resized imported pages keep their type and narrow their content

Resizing an imported page frame (or any still frame) scaled everything with it: sizes are
fractions of the frame, so narrowing a 1280 px page to 768 px set the body text at 60% and kept
the desktop layout, shrunk.

## What changed

- `fitToNode` (constrained) keeps pixels for stills: text size, stroke widths and the width of
  laid-out children stay, via `heldPixels` — the rule breakpoint views already used, now named
  and shared (`breakpoints/model.ts`). Videos keep scaling with the frame.
- URL import pins the layer that spans the page left and right (`pinnedWide`), so it fills the
  resized frame.
- A column whose content sits centred between equal side paddings drops the paddings; its
  full-width children fill it with `maxWidth` at their own width (`RestNode.maxWidth` →
  `layoutItem.maxWidth`, also read from Figma files). The cap is never below the clip's built
  width: page-flatten can widen a node after page-stacks measured it, and a smaller cap moved
  feega.app's hero by 25 px (fidelity 0.957 → 0.885) until the guard went in.
- Paragraphs as wide as their column stretch and grow down.
- `url-resize-fidelity.browser.test.ts` scores a resized plan against the page at that width.

Desktop fidelity stays (fold/full): vercel 0.988/0.971, linear 0.985/0.978, stripe 0.989/0.981,
apple 0.991/0.974, framer 0.987/0.962, webflow 0.989/0.961, tailwind 0.951/0.952, blog
0.974/0.966, feega 0.957/0.953.

## Resized vs the page at that width

See `docs/specs/url-import.md`, "Resizing". Better on vercel, linear, tailwind, blog and feega;
worse by SSIM on framer, apple, webflow and stripe at 768, where rows built with fixed widths now
run past the frame instead of shrinking with everything else. Rows that should shrink need fill
sizing the import does not infer yet; layouts a page switches at a breakpoint need the
breakpoints import.
