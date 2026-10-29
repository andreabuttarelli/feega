---
title: History
description: One timeline of everything that changed a canvas, by author.
sidebar:
  order: 10
---

Open **History** from the left rail (`Alt+6`). It lists every change to the current canvas,
newest first, in one place.

## What it shows

- **Structural changes**: nodes added, changed or removed; connections made or removed.
- **Named canvas versions** ([Versions](/canvas/versions/)).
- **Frame revisions**: each saved edit inside a motion frame.
- **Branches** of a frame.

Moves are not recorded.

## Lanes

Each author has its own lane, colour and icon, drawn as a graph beside the list:

- a **person** (one lane per member);
- the **chat** in the sidebar;
- each **outside agent** connected over MCP or the CLI (one lane per agent);
- **system** writes.

## Filters

- **All**, **AI** (chat and agents) or **People**.
- **One frame**: select a frame on the canvas, then press the frame button to keep only its
  changes, revisions and branches.

## Preview, restore, name

Click a saved version or a frame revision to open its actions:

- **Preview**: what the canvas or frame held at that point, read-only.
- **Restore to here**: puts it back. The present is kept first (a canvas version named
  *Before restoring …*, or the frame's current revision), so a restore can be undone.
- **Name this version** (frame revisions): give it a name; an empty name removes it.

The bookmark button at the top saves the whole canvas as a named version. **History** is also in
the page menu of the Pages panel and in the **More** menu of a selected frame, which opens the
panel on that frame.

## From the CLI

```bash
feega history <canvasId>            # everything
feega history <canvasId> --ai       # chat and agents only
feega history <canvasId> --people   # people only
feega history <canvasId> --frame <frameId>
feega history <canvasId> --json     # raw answer, lanes included
feega history <canvasId> --preview <entryId>
feega history <canvasId> --restore <entryId>
feega history <canvasId> --name <entryId> --as "Client review"
```

## From the API and MCP

- `GET /api/v1/canvas/{canvasId}/history?author=all|ai|people&frame=<frameId>&limit=<n>`
- `GET /api/v1/canvas/{canvasId}/history/{entryId}/preview`
- `POST /api/v1/canvas/{canvasId}/history/{entryId}/restore`
- `POST /api/v1/canvas/{canvasId}/history/{entryId}/name` `{name}`
- MCP: `view` op `list_history` `{canvas_id, author?, frame_id?, limit?}`; `edit` ops
  `preview_at`, `restore_to` and `name_version` `{canvasId, entryId, name?}`.

Each entry carries `id` (the `entryId` above), `kind`, `at`, `lane` (index into `lanes`), `node_id`, `frame_id`, `summary`
and its `author`.
