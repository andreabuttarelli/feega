# Bench: the frame-budget zoom sends one wheel per frame

`perf:budget` measured heavy-canvas zoom at 4% to 18% over budget on the same build. The zoom
gesture fired wheel events as fast as Playwright resolved them, several per frame on an idle
machine and fewer under load, so each run zoomed a different distance and paid a different
number of wheel handlers per frame. Within one session runs agreed (14–16%); between sessions the
machine's load decided the number.

The zoom now waits for a frame (rAF, 50 ms at most) after each wheel, as a trackpad does. Nine runs
over three sessions at load 7–22: zoom 1.0–1.2%, fit 1.0–1.8%, drag 2.1–3.1%, pan 1.6–1.9%. Each
run prints its own shares and the load before it, so a noisy run is visible.

The old number was not only noise: several wheel events per frame cost the product too. Coalescing
them is the next change.
