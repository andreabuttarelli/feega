# Live tiles: gate fixes for #689/#697/#699/#700

Release #701's real-stack gate failed 11 specs; bisected to #689 (store) and made worse by the live tiles.

- **Inserted shapes blinked** (`canvas-insert-flicker`): any local doc hid the poster, including the
  untouched one the editor publishes on open. The store now marks a local doc `clean` until the first
  edit (`history.past/future` empty); a clean doc keeps the poster of its revision on screen.
- **Free text invisible on its tile / poster stuck on the first draft** (`canvas-free-text`): the live
  player rested on frame 0, before the text's intro tween, and no one shot a poster once the tile held a
  local doc. Tiles now rest on the cover frame, and `posterDue` shoots from a saved local doc
  (`frameDocs.unsaved`: in flight or behind the server head).
- **Phone double-tap did nothing** (`canvas-instant-frame-edit`): the tile's player iframe swallowed the
  events; `.own` has `pointer-events: none`.
- **Last deselect blanked a frame**: a live tile counted a not-yet-decoded poster as painted and let the
  editor go; a live tile is painted only when its player drew. When the local doc is dropped by a newer
  server head, the tile keeps the last local doc until the fetch lands.

**Specs changed (old design, guarantee kept):**
- `canvas-edits-kept` reopen: dropped "a `/session` fetch happens on reopen"; reopen now reuses the
  session (#699). The guarantee — the reopened editor shows the last colour and keeps saving — is still
  asserted on the next lines.
- `canvas-edits-kept` red box: waited for `data-mode="poster"`; now waits for a drawn player or a
  poster. Red pixels are still checked before and after reload.
- `canvas-insert-flicker`: a tile whose player has drawn counts as painted, like a decoded poster.
