# Elastic and bounce eases, Copy as CSS

Jitter-parity AN-08/AN-09. The picker had five eases, all expressible as one cubic-bezier.

- `Ease.Elastic` / `Ease.Bounce` are sampled curves in `sample-track.ts` (a cubic cannot
  oscillate). `Keyframe.intensity` (0..1, default 0.5) scales decay (elastic) or restitution
  (bounce). Only the keyframe ease schema and the picker list them (`KEY_EASE_IDS`); component
  `easing` choices and every agent default stay on the five house eases (`EASE_IDS`), per the
  motion-easing-expo rule (O-06).
- HyperFrames export registers a named ease per kind+intensity (`kf-elastic-50`) from the same
  sampler, so preview and render match.
- `easeCss` (`ease-css.ts`): `cubic-bezier()` for bezier eases, `linear(...)` for springs.
  Picker gets an Intensity slider (springs only) and a Copy as CSS button.
- MCP `set_keyframes` takes `intensity`; its description says springs only when asked.

Discarded: approximating elastic with a bezier (one overshoot only, same as Overshoot).
