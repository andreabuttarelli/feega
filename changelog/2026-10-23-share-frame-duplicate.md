# Duplicate a shared frame to my workspace

A shared frame could be watched but not kept.

- Viewer (`/s/[token]/[frame]`): "Duplicate to my workspace". Signed in -> form action `duplicate`
  -> `duplicateSharedFrame` (`src/lib/server/canvas/frame-duplicate.ts`) -> new frame on the
  chosen project's Motion canvas, opened in the editor. Signed out -> `signin` stashes the frame
  path as the OAuth return and sends the visitor to `/login`; after login they land back on the
  frame. The project select appears only with more than one standard project.
- The link is the authority: the frame must belong to the shared canvas and have a published
  embed, so a revoked link or an unpublished frame copies nothing. Files flagged `uncensored`
  are never copied. Reads use the share-read service-role db (already declared); every write goes
  through the visitor's own db and org.
- The copy reuses the gallery remix path: `copyAssetFiles` (download the signed file, store it under
  the target project, new asset row, ids swapped in the doc) and `landMotionDoc` (frame node,
  adopt shaders and layouts, first revision). Both were extracted from `remixGalleryItem` in a
  separate commit with no behaviour change; so was `standardTargets` from the gallery page.
- Checked on the real stack as `test@dazero.co` (`tests/e2e/share-frame.spec.ts`): the copy lands
  in the project with a revision, the originals are untouched.

Not done: no `feega` / MCP command for it (a copy needs a target project; the app route is
the entry). Fonts and audio files are copied like any other asset; nothing is counted against a
quota here.
