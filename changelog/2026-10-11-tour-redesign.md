# Tour redesign

**Why.** The first tour (2026-10-10) was judged bare, with titles that named features
(`motion`, `canvas`, `wire it up`) instead of explaining them.

**What.**

- Six slides, outcome-first titles: make → edit by chat → every video lives on a canvas →
  connect into it → download or embed → start. Ids changed (`make`, `edit`, `canvas`,
  `connect`, `share`, `start`); `tour_slide_viewed` events carry the new ids.
- Each slide is a scene rebuilt in Svelte + CSS from the real screens: dashboard brief, editor
  with chat and timeline, canvas nodes with typed ports (colours from `CONNECTOR_STYLE`),
  export dialog and embed. `TourFilm` is a looping fake launch film reused in every scene.
- Scenes are drawn at 960×600 and scaled by `stageScale`: height always fits, on narrow
  screens the sides crop down to a 720px safe zone (`src/lib/onboarding/stage.ts`).
- Desktop: near full-screen dialog, stage above, mega title below. Mobile: full screen, the
  last slide stacks its two CTAs. Reduced motion: every scene shows its final key frame.

**Discarded.**

- Embedding the motion engine: far over the 300 KB budget for a looping illustration.
- Reusing `CanvasTile`/`MotionNode`: they need SvelteFlow and live node data. `TourNode`
  copies their look and reads the real connector colours instead.

Persistence, sidebar reopen and analytics wiring are unchanged.
