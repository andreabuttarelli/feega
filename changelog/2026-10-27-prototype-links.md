# Prototype links between frames

Figma-parity gap T1 (rows 19, 20, 23 of the audit): a layer could not point at another frame, so no
player or smart animate had anything to play.

- Contract in `packages/motion-core/src/motion/prototype/model.ts`: `Interaction` is a trigger
  (click, hover, drag, after_delay with `delayMs`), an action (navigate, open_overlay, scroll_to
  with a `target`; back with none) and a transition (instant, dissolve, slide, push; direction,
  easing from `EASE_IDS`, `durationMs`). Discriminated unions, so a navigate without a target or an
  after-delay without a delay does not parse. Stored as `clip.interactions` (max 16).
- Targets are canvas node ids of other frames. The doc does not know whether a frame still exists:
  `prototypeLinks` (`src/lib/motion/prototype/links.ts`) drops links to frames that are gone when
  it lists what to draw. The player and smart animate read the same field.
- Ops: `putInteraction` (add or replace by id) and `removeInteraction`. Link-by-click is
  `linkToFrame`; a re-aimed link keeps its trigger and transition.
- Editor: Prototype section under the layer properties (`PrototypeSection.svelte`). Link to frame
  arms `prototypeLink` (`prototype-link.svelte.ts`); the next click on another frame in
  `GpuFlow.svelte` writes the link through `commit`. `PrototypeArrows.svelte` draws one arrow per
  link and a dashed one to the pointer while aiming.
- Agent: `add_interaction` (pass `interaction_id` to replace), `remove_interaction`,
  `list_interactions`; `get_motion_doc` clips carry `interactions`. Parity table and tool-surface
  snapshot updated.

Not done: playing the links (T2), smart animate (T3), flows and starting points, overlay and scroll
container behaviour. Discarded: a separate `prototype` document on the canvas; links live with the
layer so duplicating or deleting a layer moves or drops them.
