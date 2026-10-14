# Two limits left by #548: picture opacity on text, "+" in the header

**Before.** `textPaint` folded opacity into colours and gradient stops, but an image layer has no
colour to fold into, so a picture on text drew at full strength whatever its opacity. The Fill
"+" lived in a row of its own inside the stack, under the section header.

**Now.**
- `TEXT_LAYER[Image]` wraps a faded picture as
  `-webkit-cross-fade(url(...), linear-gradient(transparent,transparent), (1-opacity)%)`: CSS has
  no per-background-layer opacity, and cross-fade is the one image function that weights a layer
  without a wrapper element. Opacity 1 writes the plain `url()` as before. Chromium and WebKit,
  the two engines that render and export, both support it.
- `FILL_LABEL` moved to `fill/model.ts`, read by the stack and the header menu.
- `Adder` (`stack-adder.ts`): `Own` keeps the stack's own "+" (poster photo panel), `Section`
  hides it; the inspector puts "Add fill" (menu of types) and "Add stroke" in the section header
  through `SECTION_ACTIONS`, only for components in `FILLED` / `STROKED`.

**Discarded.** One span per layer stacked over the text: it multiplies the DOM of every line and
breaks the per-line reveal of Title.
