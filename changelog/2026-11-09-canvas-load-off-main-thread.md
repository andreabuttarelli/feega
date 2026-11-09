# Canvas frames fill sooner on open

Opening the landings canvas left frames white for 11–17 s at 4x CPU. A new load case
(`BENCH_CASE=load`, `docs/perf-benchmark.md`) measures it with a pixel gate: a frame counts as
content only when its pixels are neither white nor canvas paper.

Timing logs showed where it went: the breakpoint views (tablet, phone) were built on the main
thread through the live-doc path, while the desktop frames already used the build worker. Twelve
main-thread builds blocked the GPU uploads. Now every frame without scenes or DOM reads builds in
the worker, and wires come precomputed (the `JSON.stringify` hotspot is gone from the profile).
Uploads go on-screen frames first.

Tried and dropped: drawing a frame with picture blocks before its images load. No gain, since
the main thread, not the image wait, was the bottleneck.
