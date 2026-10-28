# Export code: animations

Step 2 of the code ↔ design ↔ motion program: the frame's keyframes leave with the code.

- `codegen/animate.ts` turns a clip's keyframes into `Animation` IR (per-channel values, times, per-segment eases, delay, duration, loop, trigger). Channels: x, y, scale, rotateZ, opacity, text colour; any other key goes to notes.
- `codegen/ease.ts`: a bezier tuple stays `cubic-bezier`; linear stays linear; hold → step; every preset (their engine curves are not beziers: expo with settle, back, springs) is sampled from `sampleTrack`, so the export matches the canvas instead of the bezier approximation `easeCss` used.
- Targets: React → `motion/react` (`src/animations.ts` of `MotionProps`, `motion.<tag>` with a spread, `src/lib/easing.ts` for sampled/hold, `motion` dependency only when needed). HTML → `styles/animations.css`, one `@keyframes` per channel with per-stop `animation-timing-function`; x/y via `@property --tx/--ty` so they keep independent timing. Svelte → keyframes inside the component `<style>` (scoped names), `use:inview` action. `svelte/motion` discarded: CSS keyframes run off the main thread and need no runtime.
- Triggers: `interactive.playback` autoplay → load, in-view → `whileInView` / IntersectionObserver; scrub and paused → load plus a note. A clip with a "While hovering" prototype interaction plays on hover (`whileHover` / `:hover`). Loop (`interactive.loop`) repeats over the work area with leading/trailing holds baked into times.
- `easeCss` moved from `src/lib/motion` into motion-core (own commit, no behaviour change).

Not done: animation on an instance clip (noted), clips that enter after the still frame (codegen still exports the still frame's layers), scrub.
