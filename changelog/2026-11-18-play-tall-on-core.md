# Play draws frames taller than 8192 px on the core

`drawableOn` sent any frame with a side over `GPU_SURFACE_MAX_SIDE` (8192) to the HTML player.
Real landing pages run 8000 to 16000 px tall (Linear 9648, Figma 8414, Stripe 15354 in the
landings fixture), so Play showed them with browser text layout and, in local mode, without
their uploaded fonts: the sandboxed iframe has an opaque origin and `/local/storage` sends no
CORS header. Canvas vs Play at the frame width: Linear 5.48% of pixels off, Figma 1.99%, with
different line breaks and a monospace face drawn proportional.

#2318 draws Play in 2048 px strips on both cores, so height no longer reaches one surface. The
cap now reads width only for `GpuCore` and `GpuCoreGl`; `GpuFull` keeps both sides because it
has no strips. The parity spec gains a 9600 px `landing-tall` case and asserts that Play never
lands on the HTML player.

Stacked on #2318: without its strips a core surface this tall fails.
