# 0001 Realtime collaboration is host-authoritative

## Status

Accepted, 2026-11-24. Partly built on `feat/feega-inspect`.

## Decision

The owner's local editor is the single source of truth: the files on disk. No CRDT.

- Guests open `/s/<id>`, see the live app mirrored over the relay, and edit from the same Properties bar (the webview, served through the relay).
- A guest edit travels as the existing edit message over the relay channel to the host. The host runs one queue in arrival order and applies each edit through the normal live-edit pipeline, with the same impact check. An edit of unknown impact waits for the host's approval. The result and the updated preview are broadcast to everyone.
- Presence: avatars, each person's selected element and cursor on the preview, in the editor and on `/s/<id>`.
- Soft lock: an element being edited shows the colour of its editor. A second editor on the same element waits until release and sees who holds it.
- Roles per session: `viewer` comments only, `editor` can edit. The owner can change a role or remove a guest. The owner needs a Cloud plan; guests need a Feega account.
- Every guest edit is attributed in the Changes list and the host can undo it.
- When the host is offline, `/s/<id>` shows "host offline" and the last snapshot, read only.

## Why not a CRDT

The source files are the product. Two replicas that merge without the host would write source nobody reviewed, and the live-edit pipeline already knows how to turn one edit into a source change. One writer keeps a single order and a single undo history.

## Built

Roles and the edit gate with per-element locks (`inspect/src/host/share/gate.ts`), presence frames and kick/role frames (`packages/share-protocol`), the remote editor through the relay (`remote-editor.ts`), the snapshot for an ended session.

## Not built

- Host-side queue with the approval step for edits of unknown impact.
- Selection outline and cursor of each guest on the preview.
- Attribution of a guest edit in the Changes list.
- "Host offline" state on `/s/<id>` (today an ended session shows the snapshot).
- The end-to-end test: host and two guests, concurrent edits on different elements both reach the source, the same element is locked.
