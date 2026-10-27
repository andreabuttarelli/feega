# Keyframe coverage for logo, mockups and adjustment layers

The audit of `ANIMATABLE` (`keyframes.ts`) found layer kinds with only the
generic transform set: Logo, SocialMockup and CanvasMock could not key their
box size, and Adjustment had no animatable prop at all, so an adjustment
could not fade in.

Now `box()` adds `width`/`height` (Source.Param, which the GPU painter
already samples) to the three boxed kinds, and Adjustment animates `opacity`.
`adjustmentLayer`/`adjustmentTimeline` apply it as the strength of the layer.
The agent `set_keyframes` tool, `list_components`, the timeline and the
inspector read the same table, so nothing else changed.

Already covered, no change: effect params (`fx.*`), ShaderEffect knobs,
text animators, shape modifiers and fills.

Not done: Precomp time remap. Precomps are flattened into their inner clips
before render, so a keyed source time needs a remap inside `placed()` in
`precomp.ts`; left for its own change.
