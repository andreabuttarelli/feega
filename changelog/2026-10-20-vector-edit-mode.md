# Vector edit mode

A path or vector shape used to show its points the moment it was selected, so the bounding box could not be reached and a click on the shape started editing it. Now a click selects the shape as one object; a double-click enters point editing (`vectorEdit` in `MotionEditorShell.svelte`), and Esc or a click outside the points leaves it. A freshly drawn pen path starts in edit mode.

Polygon, star and line are written as a free path on entering (`enterPointEdit`, same conversion as the inspector button), so they get the same points.

Inside the mode: click a segment adds a point, Delete removes one, Alt-click toggles corner/smooth (`toggleSmooth` for paths, `toggleSmoothVertex` for networks; Alt-click used to delete a path point, Delete and Alt+Delete still do), dragging a point snaps to the frame, to other layers and to the shape's own points (hold Cmd/Ctrl to skip). One drag is one undo step, as before. Snapping reuses `snapMove` from the selection code.

Chat and MCP get `edit_path_points`: ordered move / delete / insert / smooth / corner / handle / close edits on a path, polygon, star or line. `set_path` already existed.

Not done: snapping bezier handles, snapping to rotated layer outlines (siblings snap by their bounding box), entering edit mode for rect and ellipse (they keep the radius overlay).
