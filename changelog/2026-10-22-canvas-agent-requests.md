# Canvas answers agent frame and check requests

Step 11 (#1104) removed the motion editor page; four things only it did were lost.

- **Frame/check requests**: the canvas chat now sends the selected frame as `frame` context and
  answers `data-motion-frames` / `data-motion-check` stream parts by drawing the doc in a hidden
  capture player and posting to `/motion/<node>/agent/frames` (`agent-requests.ts`,
  `agent-capture.ts`). Before, the request fell back to server frames or timed out.
- **`?brand=1`**: the old `/motion/<node>` redirect now forwards it as `?prompt=` with the brand
  remix prompt, so the compose RemixBanner link lands in the canvas chat.
- **`?brief=`**: no producer left; `BRIEF_PARAM`, `ATTACH_PARAM`, `briefAttachmentIds` and the
  URL read in `loadEditorSession` are dropped.
- **feega trailer**: "Start from the feega trailer" in the add bar (and insert sheet) replaces
  the selected frame's doc, undoable. Discarded: shipping it as a builtin template — templates
  insert as one precomp clip and require typed fields and cards.
