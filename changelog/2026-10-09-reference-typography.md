# References: typography copied per role, not only palette and scale

User feedback on the Pinterest → motion v3 run: the agent took colours, one giant title and the
alignment, and missed how the references set type — weight, tracking, leading, case, family. v3
set every text in Inter Tight 600 / -0.05 (the house title rule) against heavy grotesk posters,
and admitted it never looked again after its last edit.

- `referenceLook.type` (`reference-look-model.ts`): one `TypeSpec` per role (display, headline,
  body, label, number): font class + 1–3 Google Font candidates, weight, case, tracking (em),
  leading, size (share of frame height), align, rotation, `measured`. Plus `rules` (hairline
  count/thickness/gap) and `margin`. Recorded through `set_reference_look`.
- Gate (`reference-type.ts`, part of `off-look`): each text clip is judged against the role
  nearest its size (log ratio). Blocking: wrong family class on the display role, weight off by
  ≥300. Warnings: family on smaller roles, weight ±100, tracking ±0.02em, leading ±0.1 (multi-line
  only), case, a declared role with no text at its size, declared rules with no thin Shape.
  `LookMiss` moved to the model file so the type checks share it without a cycle.
- Engine: `textCase` (as-typed / upper / lower) on every text typography → `text-transform`.
  Weight, tracking, leading, multiple fonts and hairline Shapes already existed.
- House defaults (`HOUSE_DEFAULTS`, incl. `title-type`) are skipped by `styleProblems` once a
  `referenceLook` exists: the references set the type.
- Prompt: "Reference typography, per role" asks to measure from the picture (line gap vs cap
  height → leading, stem vs height → weight). `view_frames` with references asks for the
  typographic diff per role.
- Last look: when edits happened after the last `view_frames` (the model ignored every
  self-check nudge), the turn runs `view_frames` itself before the summary, so the summary and
  the still-open note speak from frames of the final doc. Not a forced tool choice: providers
  refuse it with reasoning on.
- Discarded: tagging each clip with a role (more work for the agent, nearest size is enough);
  per-line styling inside one clip (separate clips already do it).
