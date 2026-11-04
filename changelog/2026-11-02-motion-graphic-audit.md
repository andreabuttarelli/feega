# Motion fixes from the graphic case study

From the graphic case study (2026-11-02, canvas `8185f29b`, screenshots in
`~/Documents/feega-videos/audit/case-graphic/`), verified in the browser on a copy of that frame
(`~/Documents/feega-videos/audit/fixes/motion-*.png`, a 6 s MP4 checked with ffprobe).

- **B1, no duration control.** A frame trimmed to a 6 s loop still exported 15 s. The timeline bar
  shows the duration as a field; `setDuration` (`motion/fit-duration.ts`) trims clips past a
  shorter end (dropping those that start after it) and stretches the clips that reached the old
  end when it grows. `setCanvas` refuses a shorter duration with clips past it, so it stays the
  validator, not the entry point. The export dialog offers **Range** (Work area / Whole video,
  `exportRanges` and `rangeSeconds` in `export-plan.ts`) and passes it to the browser render,
  which already took a range. The server render does whole videos only, so a range there points
  back to the browser.
- **B2, PNG at t=0.** `selection-draw`, `still-export` and the Still span of `vector-list` seeked
  `stillSeconds(doc) ?? 0`. A doc now has an optional `poster` (`setPoster`, `posterFrame` in
  `still.ts`, clamped by `setCanvas`); `posterFrameOf` (`poster-time.ts`) is still, else poster,
  else the rest frame, and drives the canvas preview, the thumbnail and every image export. The
  frame dialog sends the time it showed (`seconds`), so a scrubbed playhead exports that frame.
  `set_canvas` takes `poster`, `export_selection` takes `seconds`, `get_motion_doc` shows it.
- **M11, Make seamless silent and not seamless.** The loop region was dragged to frame 181 while
  every clip ended at 180: `closeLoop` found no clip spanning the out point and refused, and
  `FrameTimeline` dropped the refusal. `closeLoop` now closes on the content end inside the loop
  and pulls the out point back to it; work-area edges snap; every timeline action reports its
  outcome in the bar.
- **M12, text invisible at 0 s.** `Text` had a built-in 18-frame fade-up (painter
  `Motion.FadeUp`, HTML template tween) nobody added. It is now a prop, `entrance` (`none` by
  default, `fade-up`), read by both renderers from one table each. Default `none` was chosen over
  keeping `fade-up` because the canvas text tool, Figma and URL imports all make `Text`: only a
  default fixes them all, existing canvases included. Agent videos that relied on the implicit
  fade lose it; the component description tells the agent to set `entrance: fade-up`.
- **M13, Drop letters at the playhead.** The Clip edge / Playhead choice lived in the In / Out
  section's local state; the text gallery always used the playhead. It is shared state now
  (`preset-place.svelte.ts`, `presetStart`).
- **M14.** Shift-click selection worked in this build; batch trim did not exist. Dragging the edge
  of a selected clip trims the whole selection to that frame (`trimmedTogether`, `trimClipsAt`).
- Timeline rows used `Component · id`; they use `layerLabel`, the layers panel's name.
- The graph editor labels values and seconds (`axisTicks`).
- Reopening a canvas left in Motion lands in Design: each mode names the mode it reopens in
  (`MODES[].reopens`). The playhead is not stored, so the frame opens on its poster.
