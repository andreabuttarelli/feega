# A frame edited in place lays out as desktop

**Why.** #877 keeps the canvas chat pane open while a frame is edited. That narrows the editor's
host below the desktop breakpoint, so the editor measured itself as "tablet": its body fell back
to the three-column grid and a blank panel covered the frame. The real-stack gate on dev failed
22 specs (inline play, poster text, heavy open, move, groups, agent edits) from this one cause.

**What.** When the editor seats the bar in place (desktop window, canvas mount) its viewport is
desktop, whatever the host width: the bar already sits beside it, so the host is the stage alone.

**Tests.** `right-bar-handoff.test.ts`; `canvas-inline-play`, `poster-text-kept`,
`canvas-motion-open-heavy-never-blank`, `canvas-motion-open-move`, `canvas-groups`, `canvas`,
`right-bar-persists`, `canvas-editor-transition`, `canvas-bar-centred` green on the real stack.
`colour-drag-live` counted saves on `?/ops`; since #869 the save posts `action=ops` to the API.
