# A zoom step no longer redraws every card body

Profiling a zoom gesture on the heavy test canvas (`tests/e2e/canvas-zoom-profile-probe.spec.ts`,
Chromium CPU profile) showed the WASM renderer was not the cost: about half the main-thread
time went to rebuilding the display lists of the node cards (`cardItems` → `genItems` →
`bar` → text layout). The card cache key held the label zoom step, which changes every 1/8
octave below 100 %, so every step rebuilt every card from scratch.

Only the label and the top reach depend on the zoom; the body does not. `cardsOnCanvas` now
caches the body per card at `y = 0` keyed on size and face, and moves it down by the reach
with `shiftDown` (contours, non-path matrices, scissors, mattes, paint points). The chrome is
still laid out per step. A test asserts the reused card equals a freshly drawn one at every
zoom step, so the settled pixels are unchanged.

Discarded: freezing the reach at a fixed height (unbounded as zoom goes to 0, and it changes
the list size), and splitting body and chrome into two groups (changes compositing order).

The probe also pins the camera through the saved viewport instead of pressing Shift+1, so
settled screenshots compare across runs.
