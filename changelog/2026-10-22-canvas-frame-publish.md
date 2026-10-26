# Publish, templates, still export and frame peers on the canvas (unify step 9b)

The last editor-only features reachable from a selected canvas frame, so the motion route can go.

- More menu rows (`selection-actions.ts`, ids in `frame-dialogs.ts`): `Save as template…` (`TemplateDialog`) and `Publish to gallery…` (`PublishDialog`), rendered by `FrameDialogs` from the frame's `FrameExtras` page data and posting to the same editor page actions. Nothing new server side.
- Export of a still doc opens `StillExport` instead of the video/images dialog (`docMode`). The invisible capture preview now mounts for Export and Save as template (template batch renders need it).
- `inspectorOf` returns `PropertiesView.Template` for a locked template instance; `FrameInspectorPanel` shows `TemplateInspector` for it.
- `FramePeering` (`frame-peering.svelte.ts`): the editor's frame presence (marks, beat, throttled cursor) as a class, used by `GpuFlow`. `FramePeers` mounts inside each core frame's overlay box, so cursors and selection outlines follow pan and zoom; boxes come from the core picker (`peerBoxes`). A peer already drawn as a canvas cursor keeps only its selection outline: no double cursor.
- `RemixBanner` shows over the canvas when one remixed frame is selected; "apply my brand" hands the brand prompt to the canvas chat through the `?prompt=` handoff (prefilled, not sent).

Not covered: the template dialog's live preview of a batch row (no player on the canvas; `onpreview` is a no-op). `canvas-frame-dialogs.spec.ts` fails locally at the images export (`exportSelection` returns no url), a path this change does not touch.
