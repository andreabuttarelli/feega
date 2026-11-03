# Editor audit leftovers

- **Rail over timeline.** `FloatingRail` centred on the whole canvas row; with the Motion timeline docked it covered play/loop at 760px height. It now centres on the row minus `--dock-lift`.
- **Group doc size.** `elementPixels` floored float noise (119.99999999999994 → 238 px instead of 240), so a group's doc was 2–6 px narrower than its node. Sides are settled to 1e-6 before sizing. A 2px lighter seam inside the group's outer edges right after ⌘G still shows until reload; its source is client-side and not found yet.
- **Pasted name.** ⌘V (`pasteNodes`) and ⌘D (`copyPlan`/`writePlan`) dropped `display_name`; both carry it now.
- **Set main resize.** Resizing a picked main in a component set went through the host resize, which scales the whole set, so the main grew less than the drag. `resizeSetMain` sets the main's own size, shifts the mains after it and re-hugs the set; `GpuFlow` uses it when the picked clip is a set main.
- **Hide/lock.** `hide`/`lock` left `FRAME_ONLY`, so the node right-click menu shows them; a multi-node toggle collects its writes into one gesture (`joinGestures`).
- **Frame undo/redo 0×0.** Not reproduced on dev (drag and click creation, fast and slow redo); no change.
