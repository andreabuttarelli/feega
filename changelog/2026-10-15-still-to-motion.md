# Motion on a still frame makes it animatable

Reported: on a poster, clicking Motion did nothing. `timelineHidden` includes `!timelineFits(doc)`
and a poster is one frame, so the timeline never showed.

Now Motion on a frame that doesn't fit a timeline runs `animateStill` (`src/lib/motion/still.ts`)
through the shell's `apply`, so it saves, undoes and syncs like any edit: duration 5 s
(`ANIMATE_SECONDS`), clips that reached the old end stretch to the new end (the current look is
the base), `still` is dropped (it is a video now). Design does nothing to the doc, so the duration
stays. A stored Motion preference does not apply when opening a one-frame doc: it opens in Design,
since Motion there would have changed the doc just by opening.

The timeline shows "Animate this frame — add keyframes at the playhead" while no clip has
keyframes.

Templates: no exclusions. Every one-frame template becomes a video only on an explicit click, so
no table; one would be a rule with no case.

Agent parity: `set_canvas { still: false, duration? }` runs the same `animateStill` first, so the
agent turns a poster into a video its elements span.

Guards: `still.test.ts`, `motion-still-tools.test.ts`, e2e `mode-switch-visible.spec.ts` (poster →
Motion → timeline in view, hint, saved duration > 1 frame, kept after Design).
