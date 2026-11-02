# 0032 — Custom component size is bounded by the realtime row, not by rewrite cost

Status: accepted 2026-11-02.

## Context

`MAX_HTML` 20k, `MAX_CSS` 20k, `MAX_JS` 40k and `MAX_COMPONENTS` 24 came with the first
custom components (`e4846a475`) with no recorded reason. The agent edits through
`update_components` (find/replace and line ranges) and reads through `read_component`
(numbered slices, search), so a large file no longer costs a rewrite or a full read.

## Measurements (M-series laptop, Node 22)

| | 20k/20k/40k (old) | 100k/100k/100k |
|---|---|---|
| `lintSource` (acorn) | 6 ms | 19 ms |
| `writeComponent`, 200k js | — | 86 ms |
| `sourceHash` | 0.7 ms | 0.6–1.5 ms |
| JS compile (`new Function`, 200k) | — | 6 ms |
| doc JSON, one component | 61 KB | 307 KB |
| doc JSON, 24 components at max | **1,468 KB** | — |

Every revision is a row of `motion_revisions`, published by Realtime; a Postgres change
payload is capped at **1,024 KB on every plan**. The old per-file limits already let a
doc pass that cap (24 × 60k), so the binding limit is the total, not any one file.

## Decision

- `MAX_HTML` 100k, `MAX_CSS` 100k, `MAX_JS` 200k: lint, hash and compile stay in tens of ms.
- `MAX_SOURCE_TOTAL` 700k chars across all components of a video, checked on write
  (`writeComponent`), leaving room under 1 MB for tracks, assets and JSON escaping. Not in
  the doc schema: a stored doc over it still loads.
- `MAX_COMPONENTS` stays 24: the total is what binds.

Guarded by the `ops.test.ts` cases on a 100k file and on the 1 MB realtime row.
