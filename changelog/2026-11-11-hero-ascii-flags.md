# Landing hero ASCII: cycling pride flags

Like the app's loading bar, the hero field now cycles the seven flags of
`src/lib/canvas/pride-flags.ts` (copied: landing can't import the app). It starts on a random flag
and holds each for 9 s, then cross-fades over 1.5 s with an expo in-out curve. `flagTint(t, clock, start)`
is pure and tested. Stripes with a peak channel ≤ 60 (black, #2C2C2C) are dropped so the
neighbouring stripes close over them, and every colour is lifted to stay visible on black. A
64-step palette is built once per frame instead of per cell. With reduced motion: one flag, no cycling.
