# Preview and browser export seek exact frame times

Follow-up to `2026-10-12-exact-60fps-seek.md`. The editor preview and the in-browser export
seek through the `<hyperframes-player>` element, whose `seek` message the runtime rounds to
1/30 s and which carries no `exact` option. The iframe is sandboxed `opaque`, so the parent
cannot call `__player.renderSeek` directly.

Measured before the fix (`tests/e2e/motion-60fps.spec.ts`, split-headline at 60 fps): the
browser export failed on frame 1 with "the frame at 0.02s did not draw within 5s". The
capture re-shoots any frame drawn more than 1/240 s off the asked time, and every odd frame
is 1/60 s off, so it retried until the timeout. Paused frame-stepping repeated frames.

Change: composed pages carry `exactSeekScript()` (`exact-seek.ts`), which answers a
`feega:seek` message with `renderSeek(time, { exact: true })`. `previewDriver.seek` moves the
player, then posts that message; shots and `MotionPreview` seek through it. The player's own
seek still runs so its clock stays right for Play.
Discarded: `__HF_EXPORT_RENDER_SEEK_CONFIG` in the page (switches media handling to export
mode in the live preview).
