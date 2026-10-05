# Motion editor: Play, shortcuts, panels

**Play.** The play/pause `$effect` in `MotionPreview.svelte` returned early on
`!player || !ready` — two plain `let`s, not `$state` — before reading `playing`. On the
first run the player was not mounted, so the effect kept zero dependencies and never ran
again: the button flipped to Pause, the player never started. Present since the editor was
wired; unrelated to the engine swap or WebAudio. Playback now goes through
`previewDriver.playback()`, which keeps the wanted state and applies it on `ready()`, also
after a reload. Guarded by `preview-driver.test.ts` and `tests/e2e/motion-editor.spec.ts`.

**Shortcuts.** One table in `src/lib/motion/shortcuts.ts` drives both dispatch and the `?`
help dialog. Keys are matched on `event.code` for letters and brackets, so ⌥[ and ⌘⌥B work
on macOS. Changes: S is now Show scale (split moved to ⇧⌘D); ⇧arrows step 10 frames, not a
second; J/K/L are play controls (keyframe jumps moved to ⇧J/⇧K; no reverse playback, so J
steps back one second); `[`/`]` move the clip to the playhead and nudge moved to ⌥arrows.
P/S/R/T show one property lane even without keyframes (`Reveal` in `timeline-view.ts`).
Typing in inputs/contenteditable never fires a shortcut (`isTyping`).

**Panels.** ⌘B / ⌥⌘B and header toggles hide the agent and properties columns; the
timeline height is draggable. Both persist in localStorage via `editor-layout.ts`
(read on mount to avoid a hydration mismatch, every access in try/catch).
