---
title: Project folder
description: Keep a canvas inside your project as a .feega/ folder that git can diff and merge.
sidebar:
  order: 5
---

Open a folder instead of a file and Feega keeps the canvas inside it, in `.feega/`. In the desktop
app use **File → Open Project Folder…**; from a terminal pass the folder:

```sh
npx feega ./my-app
```

## What is in `.feega/`

| Path | Holds |
|---|---|
| `canvas.json` | name and settings of the canvas |
| `nodes/<id>.json` | one node, with its own `version` |
| `connections/<id>.json` | one connection |
| `media/<id>.json` | one media item, referenced by `sha256` |
| `assets/<sha256>.<ext>` | the media bytes, stored once per content |
| `conflicts.json` | conflicts still open |
| `.base/`, `.ours/` | Feega's own bookkeeping, ignored by git |

Every file has sorted keys and ends with a newline, so the same canvas always writes the same bytes.
Feega never commits: what goes into git is your choice, including whether to commit `assets/`.

Every image, video, audio file, font and generated result is stored in `assets/`. Media that
arrived as a link is downloaded into the folder; if a download fails the canvas lists it.

## Changes from git

When you open the folder Feega compares `.feega/` with the last state it saw:

- **Only the folder changed** (you pulled): the changes load and a short notice says so.
- **Both changed**: Feega merges node by node and field by field. Edits to different fields of the
  same node both land.
- **Same field changed on both sides**: yours is kept and the other is listed under *Conflicts*
  with **Keep mine** and **Keep theirs**. Nothing is dropped until you choose.

If `.feega/` changes while the canvas is open, Feega does not overwrite it: it shows *Not saved to
.feega/ since HH:MM* and keeps your work aside until you reopen the folder.

A folder whose `.feega` is still a single [.feega file](/canvas/feega-files/) is converted on open;
the original is kept as `legacy.feega`.
