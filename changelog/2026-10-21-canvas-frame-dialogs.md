# Frame dialogs from the canvas (unify step 9)

Every editor dialog is reachable from the selected canvas frame, fed by the frame's `FrameEditSession`, with no player swap.

- Entry points: the frame toolbar's More menu (`selection-actions.ts` rows, ids in `frame-dialogs.ts`): Export, Add voice-over, Add music, Interactive (vars + presets), Components, Templates, Branches, Version history, Chat history. Gated by `unifiedFrames` through `SelectionToolbar`'s `frameTools`. Fonts and media live in the inspector.
- `FrameExtras` loads the editor page data of the frame once (`loadPageData` on its motion URL): assets, fonts, templates, render settings. It gives the inspector `assets`, `upload` and the font library, so the asset picker is no longer empty and fonts upload/rename/delete. After an upload it reloads, so the asset carries the server-signed URL.
- Export is one dialog: `ExportRows` (the canvas size rows) became a mode of the editor `ExportDialog` (`ExportMode.Images`) next to video and embed. The canvas multi-select export is a thin overlay over the same rows. The single `ExportDialog` of the canvas is no longer a separate component; `StillExport` stays in the editor shell until step 10.
- Video export keeps the capture render path: an invisible `MotionPreview` is mounted only while the dialog is open. It sits inside the viewport at opacity 0: parked off screen, lazy images never load and the export stalls at the first picture.
- Branches no longer navigate to the motion route: opening a branch selects its frame on the canvas.
- The bottom bar rises above the frame timeline (`FrameTimeline` registers as a dock) instead of sitting over it. Keys do not reach the canvas while a frame dialog is open (Esc no longer deselects the frame).

Not covered: tilt sliders of the interactive preview (no preview player on the canvas), saving a template from the canvas (TemplateDialog), voice-over/music generation was opened but not run (paid).
