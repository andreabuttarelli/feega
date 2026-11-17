---
title: Live frames
description: Show pages of your running dev server on the canvas, hot-reloading as you save.
---

In local Feega, a **live frame** shows a route of your project's dev server. Save a file on disk and the frame updates.

## The dev server

When a canvas opens, Feega looks for a dev server already running for the folder that holds the `.feega` file: it probes the common ports (3000, 3001, 5173, 5174, 4321, 4200, 8080, 8000) and keeps one only if its process works inside that folder. If none answers, it runs the project's `dev` script (pnpm, yarn, bun or npm, from the lockfile), restarts it up to three times if it crashes, and stops it when Feega closes.

| Variable | Use |
|---|---|
| `FEEGA_DEV_DIR` | Folder of the app, when it is not the one holding the `.feega` file |
| `FEEGA_DEV_COMMAND` | Command to run instead of the `dev` script |
| `FEEGA_DEV_URL` | Address of a dev server to use as is |

From a terminal or an agent:

```bash
feega dev-server            # status: state, url, detected or started, recent logs
feega dev-server start
feega dev-server stop
```

The MCP tool is `dev_server` (`action`: `status`, `start`, `stop`). The endpoint is `GET` / `POST /api/v1/local/dev-server`.

## Adding one

**Insert → Add live frame**. Type a path or pick one of the routes already imported from code, then a width: desktop 1440, tablet 768 or mobile 390.

## Live or snapshot

At most three live frames run at once: the largest on screen. The others, and all of them while the camera moves, show their last snapshot. A snapshot is taken when the page loads and when the camera rests, and is saved in the `.feega` file with the frame's route and width.

Reopened without a dev server, each frame shows its snapshot marked **Not connected**.
