# A refitted frame is not "modified"

On the traidue.com clone two imported frames turned modified with no edit, their patches
rewriting `src/app.css` font sizes (1.5rem → 0.6721rem, a different factor per frame).

Cause: text-style sizes live in frame units (`size × min(width, height)` = px). A refit keeps the
px (`heldStyles` in `custom-size.ts`), so the frame-unit number changes. `writeTokens` compared
that number with the token read at import, which is in the units of the import side
(`scale / side`). Any refit, split of a tall page or resize therefore looked like a size edit.

Style token entries now record the import `side`. `frameEdits` converts each style through px back
to that side (`inLibrary` → `inDoc` on a `side × side` square) before comparing, so only a
changed px value is an edit. Imports made before this change carry no `side` and keep the old
behaviour until reimported.

Verified on the traidue clone: frames 2 and 3 of a page split at 16384 px still went modified.
The import side was the first slice's `min(width, height)` (8800 × 160 → 160), and every slice got
the same style numbers, so the 16384-tall part showed text 55× too large. `designed` now converts
the styles into each frame's own units (px kept), so every part starts at the true px and in sync.

Considered: deriving status from the revision log since import. Rejected for now: refits write
revisions too, so the log does not separate user edits from fits without tagging every write.

Tests: `frameEdits after a refit` in `design-styles.test.ts` — refit, enlarge, 16384 px split,
no files; an edit after a refit still writes one declaration.
