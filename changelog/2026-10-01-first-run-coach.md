# First-run coach for users without a landing campaign

**Why.** A new user without a campaign still met an empty canvas and left.

**What.** A coach card (bottom-left, not a modal) with three steps:
Text node → Image connected to it → Video connected to the image. The
step is derived from the canvas itself (`stepOf` in
`src/lib/onboarding/coach.ts`), so it advances only when the user really
did it. Each step rings the real control (`COACH_STEPS` in
`coach-steps.ts`: add-bar Text, then "Connect to new…" / the picker item /
the node). Empty prompts are pre-filled from `DEMO_PRESET`.

**Run = example results.** `demo_run` action → `runDemo`
(`src/lib/server/onboarding/first-run.ts`) sets `data.example = true` on
the three nodes. No `node_runs`, no provider call. `GenNode` shows the
shipped asset (`static/onboarding/`) with an "Example result" badge,
and only while the node has no real output.

**Now generate your own.** Sets the cheapest catalogue models
(`gpt-image-2.5-flare`, `seedance-2-mini` 480p 4s) and starts the existing
workflow run (same credit gate and estimate confirm). Then the coach is
`completed`.

**State.** `profiles.onboarding_status` (`active` / `dismissed` /
`completed`), moved only from `active` (or from null to start). Starts
when: no status, no signup campaign, empty canvas, no `node_runs` in the
org. Hidden for good once dismissed, completed, or once the org has any
real run. Not localStorage: it must follow the user across devices.

**Events** (consent-gated `track`): `onboarding_started`,
`onboarding_step_completed {step}`, `onboarding_dismissed {step}`,
`onboarding_completed`, `first_real_generation`.

**Demo assets.** Generated once: image with `openai/gpt-image-2.5-flare`
($0.0038), video with `bytedance/seedance-2.0-mini` 5 s 480p from that
image ($0.177). The example text is written by hand.
