# A frame edit patches, it does not reload

Report: every edit in a frame open on the canvas reloaded the Layers tree and the canvas node.

Measured (real stack, `tests/e2e/frame-edit-patch.spec.ts`, probes on DOM identity, the stage
player's `srcdoc`, requests and realtime frames): Layers rows and the canvas node were never
remounted — rows keep their keys, the xyflow node keeps its element. What did cost, per edit:

| per edit | before | after |
|---|---|---|
| stage `srcdoc` reload (unchecked component, e.g. a fresh template) | 1–2 | 0 |
| canvas `?/snapshot` | 2–3 | 0 |
| editor `?/head` | 2–4 | 0–1 |
| `frame-outlines` GET | 1–2 | 1 (kept: it carries the derived parts, ADR 0012) |
| poster capture + upload | 1 (debounced 2.5 s) | 1 (unchanged) |
| input → second rAF | 16–51 ms | 18–30 ms |

Causes and fixes:

- `MotionPreview.capture` borrowed the visible stage player for the component determinism check
  (and agent frames): swap `srcdoc` to the check doc, then back — two full reloads, and edits made
  meanwhile were dropped until the reload. It now shoots on its own hidden capture player
  (`mountCapturePlayer`), so the stage only gets hot patches.
- Our own save and poster bumped `nodes` and came back over realtime. The canvas page could not
  tell it from a peer edit (the editor, not the page, wrote it) and refetched the whole snapshot;
  the editor re-read its head. Now `adoptFrameHead` takes a frame's new head/version in place when
  only `data` moved and nothing is dirty, and the editor skips rows whose `docHeadRevision` is not
  newer than its own (`headMoved`).

Kept: the poster capture, already debounced at 2.5 s; an agent edit still lands through the same
in-place adopt plus the editor's head pull.
