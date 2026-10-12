# Exports seek exact frame times

60 fps template exports repeated every other frame (measured: diff 0 on each odd frame).

Cause: the hyperframes runtime (`@hyperframes/core` 0.8.114) quantizes seeks to a
`canonicalFps` grid that defaults to 30; it ignores `#root[data-fps]` and only reads
`window.__HF_EXPORT_RENDER_SEEK_CONFIG.fps`. `renderSeek(t)` floored 1/60 to 0.

Change: `chromium-frames.ts` calls `renderSeek(t, { exact: true })`; callers already
pass exact frame times. After: no repeated frames in the same 60 fps render.
Discarded: setting `__HF_EXPORT_RENDER_SEEK_CONFIG`, which also switches the runtime's
media handling to export mode.
Open: editor preview frame-stepping still uses the player's quantized `seek`.
