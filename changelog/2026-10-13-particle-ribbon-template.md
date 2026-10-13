# Particle ribbon motion template

First generative GPU template: a twisting, folding sheet of up to 1M
points on a warm off-white, coloured along a four-stop gradient,
dense where it folds and dissolving into dust at the tips.

- One `three.renderer`, one `THREE.Points` with a `ShaderMaterial`.
  Every point's position is a pure function of its seed and the phase
  (parametric twisted surface + divergence-free sine flow): no
  simulation state, so any seek is exact and export matches preview.
- Seeds come from an integer hash (`particleSeeds`), built once at the
  max count; density only moves `setDrawRange`.
- Speed is whole cycles per loop, so the loop always closes.
- Title takes its own beat: the sheet veils to the background, words
  enter, leave, veil lifts before the loop ends.
- Colours are passed as raw sRGB to the shader and the background is
  CSS, so no colour-management drift.
- Fold darkening uses the analytic surface normal vs the view.
- Discarded: additive blending (washes out on a light background) and
  a GPGPU simulation (state breaks seeking).
- Runtime vars use the `ribbon_` prefix.

Emptying a template text field (e.g. the title) in the inspector or via
the agent used to restore the default: `applyValues` skipped blanks.
`setTemplateValues` now passes `Blank.Clears`, and only types marked
`clearable` in the coerce table (text) take the empty value; inserting
with blanks still keeps defaults.
