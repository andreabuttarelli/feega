# gpu-full draws text animators

Text with animators used to be named `animator` and skipped. Now each character, word or line is
its own unit, like the page's inline-blocks: per-character animators shape every character alone
(no kerning across units), `ta.*` keyframes are sampled per frame, and selection uses the same
`selection()` and seeded positions the page uses. Opacity, offset, scale, rotation (about the
unit's box centre), colour (`color-mix` in sRGB, last animator wins) and blur are drawn.
Tracking animators still reflow the page every frame and stay named.

Parity (`kinds.ts animators`, `--ref=live`, 6 frames): mean SSIM 0.9960, worst 0.9945, ≤0.53% pixels off.
