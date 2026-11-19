# 0041 — The canvas lives in a `.feega/` folder; one semantic merge for local and web

Status: accepted 2026-11-19.

## Context

A canvas has to live next to the code it designs: in the user's project folder locally, in the
user's GitHub repo on the web. Git merges lines, a canvas is a tree of typed nodes: a line merge of
one JSON blob corrupts it, and an export with no merge silently loses one side.

## Decision

- **Local/desktop:** the canonical state is the `.feega/` folder in the user's project. Feega never
  commits; git is the user's.
- **Web (GitHub only, via Composio):** the canonical live state stays in Postgres (live, unflushed,
  merge base, history). The working branch always receives a deterministic `.feega/` snapshot at
  every summary commit and before every PR. If writing it fails, the PR is blocked and a visible
  "not saved to the repo since HH:MM" banner shows.
- **Format, final from day one** (so web authority can later move to the repo without migration):
  - `.feega/canvas.json` — name, source ids, agent choices.
  - `.feega/nodes/<id>.json` — one file per node with its own `version`; a frame's document as
    `head`.
  - `.feega/connections/<id>.json`, `.feega/code-links/<id>.json`, `.feega/events.json`.
  - `.feega/media/<id>.json` — asset rows, referenced by `sha256` (+ `ext`; + `url` on web).
  - `.feega/conflicts.json` — open conflict records.
  - Every file: keys sorted at every depth, two-space indent, one trailing newline.
- **Every graphic asset is local in local mode:** images, videos, audio, fonts, posters, AI output
  and files dropped or picked from cloud sources live in `.feega/assets/<sha256>.<ext>`, referenced
  by hash, stored once per hash. Never only a remote URL: remote media is downloaded into
  `assets/` before it is referenced on disk. A project with remote URLs is migrated on open; a
  failed download does not stop the others and is listed to the user.
- **One merge engine** (`packages/canvas-folder`), shared by local and web: 3-way, per node id and
  per field of `data`; adds, deletes and moves. Never `git merge` on the JSON. On a conflict mine
  is kept and theirs is written to a conflict record; on delete-versus-edit the edit is kept and
  the delete recorded. The losing side is never dropped.
- **The merge base is content, not a SHA.** Local: `.feega/.base/`, a copy of the last state Feega
  read or wrote; Feega's unsaved state, when it may not overwrite the folder, waits in
  `.feega/.ours/`. Both are listed in `.feega/.gitignore`. Web: a table of ours.
- **External changes integrate only on explicit accept** (opening the folder, Keep mine / Keep
  theirs), never by live rebase of a room. A change made on disk while the canvas is open is never
  overwritten.
- **Assets:** local ones stay in the folder (the user chooses to gitignore or commit them); web ones
  stay in storage, with an optional "vendor assets" later.

## Rejected

- Repo-canonical web with a truncated op-log and a WIP ref: an ambiguous ack loses data.
- One JSON blob plus `git merge`: line merges corrupt documents.
- Optional export without merge: one side is silently lost.
- Binaries in the repo or LFS by default.

## Consequences

The single `.feega` file stays readable: opening a folder whose `.feega` is still that file moves
it into the folder and keeps the original as `legacy.feega`. The web snapshot writer is a separate
change.
