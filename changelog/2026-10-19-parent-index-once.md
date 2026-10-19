# Parent and clip indexes built once per doc

`ancestorsOf` rebuilt a map of every clip's parent on each call, and `worldAt` a map of every
clip by id. Compose, the timeline and the selection overlay call them once per clip, so on a
270-clip landing the work was quadratic: ~28 ms of `parentMap`/`clipsOf` self time when a frame
opens (Chrome CPU profile, prod build).

Both maps are now kept in a `WeakMap` keyed by the doc object, which every edit replaces (ops are
functional), so an index never outlives the doc it describes. Two tests hold the scaling: 2,000
lookups on a 10,000-clip doc took ~1.4 s each before, now well under 300 ms.

After: parent.ts self time on open 28 → 2 ms.
