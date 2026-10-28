# Seven effects After Effects has

Added to the effects registry: displacement map, radial blur (zoom and spin),
lens blur, bulge, twirl, sharpen (unsharp mask) and chroma key with spill
suppression. Inspector, `fx.*` keyframes and the agent's `add_effect` read the
registry, so nothing else lists them (only `scale-tool.ts` learns which
params are pixels).

Sharpen, displacement and chroma key are plain SVG primitives, so every
backend already runs them. Bulge, twirl, radial and lens blur need per-pixel
geometry no SVG primitive gives: one new `feWarp` primitive, one `Warp` pass
in gpu-core (WGSL and GLSL), mode picked by an attribute. A browser SVG filter
ignores `feWarp`, so those four show only in the GPU renderer.

Chroma key is a linear projection on the key colour's chroma axis, not a
hue test: it works for any saturated key. Spill is a linear de-cast kept only
where it darkens (`feBlend darken`).

Discarded: a displacement layer input (effects have no second input), a
separate pass per warp mode.
