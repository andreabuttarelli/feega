# Project library for styles and variables

**Why.** Styles and variable collections lived only inside each frame's doc. The canvas "library"
was gathered from the frames currently open, so a style disappeared with its last frame and never
reached another page of the project.

**What.** New table `project_library` (`kind` = `style` | `variables`, unique per project, kind,
name; org RLS). `GET/POST /api/v1/projects/:id/library/:kind` with ops `save`, `rename`,
`remove`, `adopt`. The canvas opens the library on mount; `StyleLibrary` and `VariableLibrary`
apply each change locally, save in the background and roll back with a notice if the save fails.
A left-rail Styles panel (Alt+7) creates, edits, renames and deletes styles.

**Migration of old data.** Lazy and non-destructive: styles and collections found in frame docs
are adopted (`adopt` = insert, ignore duplicates), so a project entry with the same name always
wins; frames holding a stale copy are brought up to date. Doc copies stay, so renders and exports
keep working without the table. A URL import adopts its styles and collections right after the
frame is written. Collections are stored without `active`: the mode stays per frame.

**MCP.** The `styles` and `variables` canvas ops read and write the project library; `styles`
gains `remove`.

**Discarded.** Two tables (one per kind): same shape, twice the code. Dropping doc copies: every
renderer reads them.

**Pending.** Migration `20261031100000_project_library.sql` is not applied to production; until it
is, the library reads empty and the canvas falls back to frame copies. Follow-ups: free elements
and frames share one style path (MCP `styles` skips element nodes), per-property overrides.
