# Components panel across canvases

Components resolved only within the open canvas (`canvasComponents` fed
from GpuFlow's live docs), listed under Assets. A component made on one
canvas could not be reused on another.

- Rail entry `components` (Alt+5, group `panel` so earlier shortcuts
  keep their digits) opens `ProjectComponentsPanel`: search plus one
  `ComponentsList` per canvas. `ComponentsList` now takes `groups` and
  `title` (default: the live canvas), shows the frame poster, and has
  a Copy button / ⌘C per row.
- Server: `listProjectComponents` / `readComponentSource`
  (`server/canvas/project-components.ts`) read motion nodes + heads;
  `componentSlice` keeps only the main and its nested comps.
  Endpoints `GET /api/v1/projects/:id/components[/:frameId/:compId]`
  accept a bearer or the session cookie (`project-scope.ts`).
- Drop: `dropComponent` falls back to fetching the slice when the
  source frame is not live. Paste: clipboard text
  `feega-component:{...}` places an instance in the frame under the
  pointer or the selected frame.
- CLI `feega components <projectId>`; MCP op `list_project_components`
  (the motion tool `list_components` is a different thing).
- Not done: dropping on empty canvas (needs a target frame); thumbnails
  are the frame poster, not a render of the component.
