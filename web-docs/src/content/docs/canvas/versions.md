---
title: Versions
description: Frame revisions, undo, and branching.
sidebar:
  order: 9
---

## Canvas versions

- **Save the whole canvas under a name** from the page menu (Pages panel, … on the current page) and restore it later. Restoring keeps the moment before it as a version too, so a restore can be undone.
- A version holds every node, connection and the content of frames and free elements.

## Frame versions

- **One undo history** covers edits in the frame. `Cmd+Z` and `Shift+Cmd+Z`.
- **Named versions.** Name the current version of a frame from its version history.
- **Revisions.** Select a frame and open More to branch and restore versions. Frame edits are ops rebased on the head ([ADR 0007](/architecture/adr/0007-frame-edits-are-ops-rebased-on-the-head/)).
- **From the CLI:** `feega motion revisions <nodeId>`.
- **From MCP:** `list_motion_revisions` and `restore_motion_revision`.
- A stale write is refused with `409` when it carries an old `version`; nothing is overwritten silently.
