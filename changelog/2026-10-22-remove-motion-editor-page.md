# Remove the full-page motion editor

Step 11 of the canvas/editor unification. The 13 editor-only features moved to the canvas
(#1096–#1102), so the `motion/[nodeId]` page and `MotionEditorShell` go, with the code only they
used: `MenuDrawer`, `OverflowMenu`, `SelectionOverlay`, `SideColumn`, `ZoomStage`, `DrawTools`,
`IconMenu`, `CompositionSettings`, `compose-once`, `move-gate`, `peaks-decode`, `phone-bar`,
`preview-audio`, `preview-view`, `selection-context`, `motion-channel`, and `Mount`/`MOUNT` in
`editor-mount.ts`.

- `GET /p/:p/c/:c/motion/:node` now answers 308 to `/p/:p/c/:c?frame=:node`; the canvas reads
  `?frame=`, selects the node, brings it into view and drops the param.
- `motionEditorPath` (every `editor_url`, dashboard and redirect) builds that canvas URL.
  `motionNodePath` keeps the old path as the base for page actions and the kept subroutes
  (preview, source, embed, live, session, batch, templates); actions already reach
  `/api/v1/projects/:p/canvases/:c/motion/:node` through the bearer twin.
- `briefEditorPath` had no caller and is gone.
- E2E specs that only opened the editor page are deleted; mixed specs lose their page step.

Not ported, reported: the editor answered the motion agent's in-browser frame/check requests
(`FRAMES_REQUEST`, `CHECK_REQUEST`); the canvas does not, so those fall back to the server path or
time out. `?brief=` and `?brand=1` auto-sends and "start from the feega trailer" lived only in the
shell; `run-check`, `luma-decode` and `trailer` stay for a later port.
