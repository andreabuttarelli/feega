# Record the canvas

`RecordControl.svelte` (bottom right of the surface) records the selection's on-screen bounds, or
the whole view, to a video of at most 60 s (`RECORD_MAX_SECONDS`), with optional mic narration.

Path: click Record in `RecordControl.svelte` -> `startRecording` in `area-recorder.ts` ->
`MediaRecorder` -> `File` -> `onUpload` in `GpuFlow.svelte` -> `upload` in the canvas page ->
`canvas-assets` bucket + `upload` action -> a video node. The same file is offered as a download.

How frames are captured: `drawImage` straight from the WebGPU canvas gave black frames (the buffer
is cleared after presentation). The core canvas is read through `captureStream` into a muted
`<video>`, and each animation frame crops it onto a 2D canvas that feeds the recorder. The
backdrop is filled first because the core canvas is transparent where nothing is drawn.

Considered: the motion export pipeline. It renders a frame's timeline offline; a canvas recording
is the live screen, not a timeline, so nothing fits and nothing is reused. Considered:
`getDisplayMedia`. It prompts every time and captures browser chrome.

Limits: DOM overlays (selection handles, rulers, live iframes inside a frame) are not in the
recording, only what the core canvas draws. No segment chosen by drawing a rectangle yet.
