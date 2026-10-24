# Scenes panel: reorder, length, transitions

A combined video frame shows a Scenes section in Properties: drag to
reorder, a length per scene, and a transition into each scene after the
first (the existing junction kinds). Every edit repacks the scenes back
to back (`reorderScenes`, `trimScene`, `sceneTransition`, `removeScene`,
`appendScene` in src/lib/motion/scenes.ts). Agents get the same through
the `edit_scenes` motion tool (insert / reorder / trim / remove);
transitions through the existing `set_clip_transition`.

Fixes found in the browser:
- the export dialog rendered before the scene sources loaded and
  exported black frames; it now waits for them;
- scene groups expanded earliest-on-top, so the incoming scene was hidden
  during a transition; resolved scenes now stack latest-on-top.

Known gap: a crossfade fades the incoming scene's text but not a shape
covering the frame, because group opacity does not reach every child in
the renderer. Push, zoom and cuts render as expected. The
soundtrack is the parent's own Audio track (Add voice-over / music
already target it).
