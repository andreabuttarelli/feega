# Motion playback: latest frame wins, time-invariant work once

Measured in local Chrome (3 frames of launch templates, one playing, dev server): before, the picture of a playing frame trailed the playhead by 1.8–9 s.

Two causes. Every playhead step queued a full rebuild, and nothing dropped superseded ones. And a frame the worker refuses (empty media placeholders, Custom/Device3D/Composition clips) fell back to `buildSource` on the main thread every tick: scenes, fonts, `prepare`, a fresh DOM-read iframe mounted through the read pool, then one read. Those queued for seconds.

- `latestOnly` keeps one live build in flight per frame; newer requests replace the waiting one.
- `heldBuilds` prepares a playing frame (and mounts its DOM reader) once per doc; a tick only reads and draws. The worker is asked once per doc, not per tick.
- `mountCustomReads` reads empty-media placeholders once; only Custom/Device3D/Composition clips are read per frame.

Not done: main-thread time at 4x CPU throttle is dominated by native work outside JS (`(program)` in the profile), not by the motion build.
