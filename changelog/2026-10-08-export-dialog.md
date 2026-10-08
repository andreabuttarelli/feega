# Export dialog redesign

**Why.** The dialog opened on cryptic tabs ("Video | Interactive (web)") and the embed side was a
wall of labels and raw iframe code. Users could not tell what to do.

**Now.**
- First screen asks one question: *Video file* or *Embed on a website* (`ExportMode`, prop
  `opening`; a running server render opens straight on Video).
- Video: format, resolution, quality as segmented choices; size and cost/where line; frame rate,
  audio and background render under *Advanced*. Presets row dropped: every preset is reachable by
  the three choices plus frame rate.
- Embed: `InteractiveExport` keeps the network/state, `EmbedView` is pure props (render-tested).
  Order: live preview (the bundle itself in a sandboxed iframe) → interactivity in plain words →
  one *Publish embed* → code + *Copy code* + quiet *Update*/*Unpublish*. Playback, loop, nested
  layers and self-hosting under *Advanced*.
- `reactionsOf(doc)` (`interactive/summary.ts`) maps live input lanes to plain phrases through one
  table, `INPUT_REACTION`; `input.time` is not interaction; scroll-scrub playback counts as scroll.
- *Interactive presets* link closes the dialog and turns on the interactive preview bar.
- Fixed `renderHere`, which assigned an undefined `Mode.Browser`: it now clears `background`.

**Checked.** "Nothing reacts yet" on node 63239289 was correct: the liquid drop is driven by
`spring(..., time, ...)`, no `input.*`.

**Discarded.** A server `updated_at` for "updated 2 min ago": the embed endpoint has none; the
status says "updated just now" only after an update in this session.
