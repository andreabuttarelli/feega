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

The panel is read-only for now.

## From the CLI

```bash
feega history <canvasId>            # everything
feega history <canvasId> --ai       # chat and agents only
feega history <canvasId> --people   # people only
feega history <canvasId> --frame <frameId>
feega history <canvasId> --json     # raw answer, lanes included
```

## From the API and MCP

- `GET /api/v1/canvas/{canvasId}/history?author=all|ai|people&frame=<frameId>&limit=<n>`
- MCP: `view` op `list_history` `{canvas_id, author?, frame_id?, limit?}`.

Each entry carries `kind`, `at`, `lane` (index into `lanes`), `node_id`, `frame_id`, `summary`
and its `author`.
