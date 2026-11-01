# URL import: imported text edits like native text

Found recording the Import-from-URL video on vercel.com.

## What was wrong

- **Groups were Precomps.** `figma-doc` turned every frame without auto
  layout or paint into `grouped()`: a `Precomp` clip over a comp, with no
  `width`/`height` of its own. Native grouping (`frame_clips`) makes a
  frame with parent-linked children. The canvas picks top-level clips
  only (`isLayer`), so a click inside such a group always landed on the
  Precomp, Esc from a member selected a 0×0 layer, and the codegen named
  the comp `Group N`.
- **Text inside an instance could not be typed.** `startTyping`,
  `textCaretAt` and `commitText` look the clip up at the top level;
  a scoped id (`host__0__text`) is never there. Cmd-click selected the
  label, Enter and double-click did nothing or climbed back to the host.
- **Every Button twice in Layers.** An instance row is followed by its
  main's root frame, named the same (`Button` › `Button` › label).

## What changed

- `planOf(..., Grouping.Frame)` (URL import only): a plain frame holding
  two or more layers becomes a frame Shape with its children parented
  (`Background.Frame`), with the frame's real box and name; one layer is
  kept unwrapped. Instances and Figma paste keep `Grouping.Precomp`:
  instance diffing compares an instance's own build to its main, and
  Figma tests pin paste groups. GPU fidelity on the v2 captures:
  linear 0.882/0.956, stripe 0.974/0.899, vercel 0.997/0.921 (fold/full),
  dev 0.884/0.952, 0.974/0.897, 0.997/0.921.
- `scoped-text.ts`: `textScope` resolves a scene id to its comp view
  (via `scoped`), the caret is mapped back with `Scoped.fromView`, and
  `commitScoped` merges the typed text as an instance override.
  `doubledOn`: a double-click on the already-picked deepest clip stays on
  it and opens typing, instead of falling back to the top-level host.
- `soleFrame` (main-component): a main whose tracks hold one root with
  children; Layers shows that root's children directly under the
  instance row.

Discarded: hiding the root from picking too (its fill and padding would
become unreachable); making Figma-paste groups frames in the same change.
