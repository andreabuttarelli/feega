---
title: Versions
description: Frame revisions, undo, and branching.
sidebar:
  order: 9
---

## Canvas versions

- **Save the whole canvas under a name** from [History](/canvas/history/) (the bookmark button) and restore it later from its row. Restoring keeps the moment before it as a version too, so a restore can be undone.
- A version holds every node, connection and the content of frames and free elements.

## Frame versions

- **One undo history** covers edits in the frame. `Cmd+Z` and `Shift+Cmd+Z`.
- **Named versions.** Name a revision of a frame from its row in [History](/canvas/history/).
- **Revisions.** Select a frame and choose **History** from More: the panel opens on that frame, where each revision can be previewed and restored. Frame edits are ops rebased on the head ([ADR 0007](/architecture/adr/0007-frame-edits-are-ops-rebased-on-the-head/)).
- **From the CLI:** `feega motion revisions <nodeId>`.
- **From MCP:** `list_motion_revisions` and `restore_motion_revision`.
- A stale write is refused with `409` when it carries an old `version`; nothing is overwritten silently.
