# Draw, pen, mask, align on the core canvas (unify step 8d) and rotation fixes

`FrameTools` (rendered inside `FrameOverlays` for the frame being edited) hosts the motion overlays: Draw, Pen, Vector, Mask, AutoLayout, TextPath, LayoutGuides and the AlignBar. Which ones show is one table in `frame-tools.ts` (`shownOverlays`).

- One tool state: `frameBar.tool`. With a frame selected the draw overlay draws into it; the canvas-level `CanvasDrawLayer` only takes over without a frame (or for the Frame tool). Edits go through `commit` -> `FrameEditSession`.
- Overlays read pointers through `overlay-point.ts`, which undoes the frame rotation (`data-turn` on the overlay frame). Before, they divided by the bounding box of a turned host.
- Enter on a selected path/vector opens point editing; a finished pen path opens it too.
- Rotation: the core painted a turned group's background as the bounding box of the turned rect (`groups.rs::used`); it now paints the turned quad. The purple hover outline moved into `FrameOverlays`, so it shares the transform of the selection handles. `static/gpu-core` rebuilt.

Known gap: clips with a mask are not in the core pick scene, so they cannot be picked on the canvas (select them from Layers/timeline). Align bar turns with the frame.
