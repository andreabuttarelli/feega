# After Effects blend set

The registry had the 16 CSS modes. Added linear burn, linear dodge (Add), vivid light, linear light, pin light, hard mix, subtract, divide, darker color, lighter color: 26 total. Dissolve left out (stochastic, no stable frame).

CSS has no `mix-blend-mode` for these, so `blendStyle` emits nothing for them and the GPU paths do the work: the same formulas live in `blend-colour.ts` (CPU reference), the WebGL blend fragments (`gl-kit.ts`, `webgl-device.ts`) and gpu-core (`filter_passes.rs` WGSL, `gl_passes.rs` GLSL). New values are appended after `luminosity`, so existing shader indices do not move.

In gpu-core, Vello's native `Mix` has no equivalent, so `shader_only` modes always go through the composited path (`layers.rs`), even when `Blending::Native` is on.

Inspector and the `set_blend_mode` agent tool read `BLEND_MODES`, so both gained the modes with no further wiring. Hybrid note: the HTML/CSS fallback preview shows these layers as normal.
