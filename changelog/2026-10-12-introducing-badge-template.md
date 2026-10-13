# Introducing badge template

Built-in `builtin:introducing-badge`: "Introducing [glass pill badge] feature" on a near-black
field with violet corner glow and a large planet arc rising from the bottom. The badge grows
0.9 → 1 with expo in-out (no overshoot) and gets one shine sweep after landing. Row in landscape,
column below 1.25 aspect. Loops: all leaves in the last ~1.4 s. 14 s default.

The right-hand label cycles a `features` list (one per line, key field): each swap is a 0.6 s expo
in-out rise-and-fade, slots split evenly between `nameAt` and the exit, so any count fits the
duration (5 features at 14 s ≈ 1.5 s still each). Features stack in one grid cell so the row never
reflows between swaps.

No brand copied from the reference: default wordmark "your"+"app", neutral four-point spark glyph
(an optional `logo` media field replaces it), fresh violet palette. Badge is a full pill, not the
reference's rounded rectangle (shape rule). Arc exit now reaches exactly 0 at the last frame (float
error showed at 14 s).
