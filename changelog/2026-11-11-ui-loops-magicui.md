# Magic UI and Animata loops as motion templates

Twenty MIT components from Magic UI (meteors, ripple, marquee, number ticker, word rotate, typing, morphing text,
gradient/shiny/aurora/line-shadow text, orbiting circles, spinning text, flickering and animated grids, border
beam, shine border, animated list, circular progress, hyper text) are builtin templates `builtin:magicui-<id>`.

Animata (MIT, `LICENSE.md`, Copyright (c) Animata) adds glitch text and jitter text as `builtin:animata-*`.

Why: backgrounds, text accents and card effects were the gap in the library next to the snapcn product scenes.

How: same machinery as snapcn (`SnapcnPort`: typed props + `draw(S, view)`), in
`packages/motion-core/src/motion/uiloops/ports/`. Three new categories (Background, Effect, Icon). CSS keyframes are
reproduced as exact functions: `S.cycle` (looping phase with delay), `S.interpolate` with the css `ease` and
`ease-in-out` curves, framer `easeOut`. Overdamped framer springs (number ticker 60/100, list 350/40) use the
closed form, checked in `timing.test.ts` against an RK4 integration of the same ODE. Math.random in the originals
becomes `S.random` seeded by element and frame, so seeking is deterministic.

Skipped: shader, WebGL and DOM-measuring components (globe, particles, confetti, dotted map, light rays, dock),
device frames and brand-named items, cursor/hover-only components (they need a pointer).

Not ported, licence: reactvideoeditor/remotion-templates states MIT only in its README (no LICENSE file); left
for a decision.
