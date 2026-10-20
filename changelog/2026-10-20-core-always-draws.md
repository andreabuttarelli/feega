# Core canvas: the core always draws every frame, the live editor is an overlay

Step 1 of making the inline editor a transparent overlay.

Before, a frame handed to the live editor (`domIds` + `TILE_PAINTED`) was removed from the core
(`hidden`, #1022). When the DOM copy was not actually visible at that zoom the frame vanished
(the landing blank after a zoom, user's `coreDebug` log: `layer=real why=live editor`); when it
was visible, two copies existed.

Now `hidden` / `liveEdited` are gone and the core draws every frame, the edited one included. The
live stage's content is invisible in core mode: `.host` and `.gpu-wrap` of
`[data-testid=motion-preview]` get `visibility: hidden` (layout stays, so `measure()` and the
selection overlay keep working) and the preview's black backdrop is transparent. Only the
overlay children (selection, handles, guides) show. While a text is being edited
(`data-text-editing` on the preview) the host stays visible so the caret and IME still work; that
is step 3, until then the text is drawn twice.

Left for the next steps: element boxes from the core layout instead of the DOM measure, the
hidden text input with core-drawn caret, a fast path that redraws the edited frame without
waiting for the retained refine, and the text-fit write-on-open in `MotionEditorShell`
(`fitTexts` writes DOM-measured boxes into the doc for `sizing: auto`; it must not run on open).
