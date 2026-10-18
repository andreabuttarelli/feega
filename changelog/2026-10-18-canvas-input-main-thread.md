# Canvas: less main-thread work under the pointer

Profiles of the fluidity scorecard on a production build (Chrome, heavy
canvas copy) showed four costs landing inside interactions:

- Card capture (html-to-image, ~170 ms) ran during recolour and drags.
  It now waits for 400 ms without pointer, wheel or key input and an
  idle slice with 12 ms left. The tainted-canvas readback
  (`getImageData`, ~33 ms) runs only when the card holds a cross-origin
  image, which is then filtered out up front instead of capturing twice.
- `screenSize()` called `getBoundingClientRect` from effects, derived
  values and every pointer event, forcing layout. The surface rect is
  now measured on resize, pointer enter and pointer down.
- The capture scheduler re-ran on every drag frame; it now sleeps while
  input is busy. Hover-intent DOM tiles mount only once input is quiet.
- The chat composer re-measured its textarea (forced layout, ~11 ms)
  whenever its effect re-ran; it now re-measures only when the text
  changes.

Result, 3 runs each: align 96 -> 72 ms p95, select another node 64 -> 56;
the other steps did not move (56 ms on most). A run without the CDP
screencast gave the same numbers, so the 56 ms floor is not the harness.
In isolation (no inline editor open) a node click has no task over 8 ms;
the remaining cost sits in the open inline editor, next to investigate.
