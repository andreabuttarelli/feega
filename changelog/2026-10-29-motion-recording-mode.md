# Motion mode records, Design scrubs

Issue #1517, spec `docs/specs/editor-modes.md`.

- `MODES` gains `chrome` (`Plain`/`Recording`) and `timeline` (`Hidden`/`Scrub`/`Edit`). Motion is
  the only recording mode: a `--ui-recording` border on the canvas wrap and the properties bar.
- `⌘J` (canvas shortcut `timeline`) toggles the timeline per mode. Design opens it as `Scrub`:
  playhead moves, `onchange` is dropped. Motion opens by default as `Edit`.
- `frameTimeline` replaces the direct `timelineShown` call in `GpuFlow`; frames that cannot
  animate still never get an editable timeline.
- Keying at the playhead, the ◇ toggle and Design's whole-animation shift with notice already
  existed (`editIn`, `toggleKey`, `designWarning`); reused, not rebuilt.
- Not done: onion skin and motion paths (no renderer exists yet), voice-over in the Motion bar.
