# Canvas session memory stays flat

Perf audit round 2, hotspot 8: a 3-minute session on the 30-landing audit canvas grew the JS heap 187 → 538–639 MB and DOM nodes 7k → 28k–151k.

Cause, found with heap snapshots (`.perf-audit/leakprobe.mjs` + a retainer walk): `CoreFrames` kept every display list it ever built in `lists`. Each live edit step (drag, typing, inspector) builds a new `${frameId}:live${n}` list, a whole frame's items; none was ever dropped. Two drags held 66 lists of one landing, ~150 MB of strings.

Now `listed` (`src/lib/canvas/core/frame-lists.ts`) replaces a frame's list and drops that frame's older lists unless still shown, loaded or held on screen while the new one draws. At most a few lists per frame, however long the session.

Also: the GPU texture budget follows the canvas size (`textureBudget`, 12 screens of device pixels) up to the device ceiling, instead of a flat 256 MB / 128 MB.

Measured (dev server, desktop, CPU 1×): heap at end 613 → 232 MB, DOM nodes 141k → 28k, listeners 1872 → 1241. Not chased: the remaining ~20k DOM nodes are inspector UI mounted once per panel kind; they stop growing after the first visit (repeat select/dblclick rounds add nothing).
