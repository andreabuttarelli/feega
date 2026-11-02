# Still frames get the timeline in Motion

A still frame opened in Design even in Motion mode (`startMode` gated on
`controlShown(EditMode)` and `timelineFits`), so the timeline never showed.

Decision: no static/animated distinction for the timeline. A still is a frame with no
animations. The edit mode now comes only from the editor mode (`readMode`), and the canvas
hands the timeline `timelineDoc(doc)`: a one-frame still is stretched to `ANIMATE_SECONDS`
via `animateStill`, so the timeline has a duration to render. The doc is only rewritten
when the timeline commits an edit.

Removed: `startMode` and its still-gating test in `frame-controls.test.ts`.
