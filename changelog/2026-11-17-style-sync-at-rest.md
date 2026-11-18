# Style library sync waits for the canvas to rest

`GpuFlow`'s effect calls `styleLibrary.found` as frames load. For every frame holding an older copy
of a project style, `found` pushed the library value straight away, and `syncStyle` committed an
edit ("Updated the X style"): on the 36-page stress canvas one frame was rewritten mid-load, with
~365 ms of main-thread history work while the first frames were still being handed to the core.

`StyleLibrary.connect` now takes an `atRest` scheduler (`paintThenIdle(afterPaint, whenIdle)` in
`GpuFlow`); `found` records what it saw and owes one sync, run once the canvas has painted and is
idle, against the latest docs. "The library wins" is unchanged; only its timing moved off the load
path. The variable library has the same shape and was left as is.
