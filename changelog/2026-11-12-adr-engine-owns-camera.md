# ADR 0037: the engine owns camera, culling and the canvas overlay

Trace of a 4 s heavy zoom puts the main thread, not the GPU, at fault: wheel handlers 1.4 s,
app JS 1.5 s, style recalc 0.4 s. The ADR moves camera math, the visible set, card text
transform and the canvas overlay into gpu-core, in four measured PRs. Docs only; no behaviour
change yet.
