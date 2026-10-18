# The last whole-doc frame writes go through ops

Four server paths still wrote a full frame doc at an expected version, so
a peer commit landing in between made them a conflict (or, for undo, a
silent no-op): template insert from the API (`template-api.ts`), the
editor/MCP `save_doc` op (`editor-ops.ts`), every element move between
frames (`move-element.ts` `frameStore.write`), and canvas undo of a frame
(`undo.ts` `restore_doc`).

They now call `commitOnto` (`frame-ops.ts`): it reads the revision the
caller based its doc on, diffs it to the new doc and commits the ops with
`commitDoc`, which rebases onto the newest head. A peer's edit to another
field survives; the caller's fields win. Version 0 (a brand-new frame) is
written as is. `save_doc` now parses the doc before committing and answers
400 for an invalid one, as before.

`headOrNew`/`newHead` take only the node's `format`, the one field they
read, so `commitOnto` needs no node lookup.
