# Engine: an overshooting ease never writes a negative size

Signal: the CTA circle wipe in the browser render jumped back to a large
circle on frames 195-197 (one per capture lane), then vanished. Only the
4-lane fast capture showed it; `?capture=exact` did not.

Cause: `feega.inOut`/`feega.out` settle 1-2% past the mark, so a tween of
`circle(150%)` to `circle(0%)` passes through `circle(-1.2%)`, and
`blur(18px)` to `blur(0px)` through `blur(-0.3px)`. Negative radii are
invalid CSS: the browser drops the write and the element keeps its last
value. In a single lane that is the previous frame (near 0, invisible); in
lane N it is the frame 4 earlier, a visible step back.

Fix: `withoutNegativeSizes` clamps negative numbers inside the sizing
functions listed in `SIZE_ONLY_BEFORE_AT` (filter functions; `circle`
and `ellipse` before `at`, whose positions may be negative).

Measured: fast render now matches the exact one on every frame (mean abs
diff <0.6 on all 270 frames; before: 10.8 and 2.0 on frames 195-196).
