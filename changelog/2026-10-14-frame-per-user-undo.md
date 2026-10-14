# Per-user undo in a shared frame

Before: `History` kept whole-doc snapshots, so ⌘Z in a frame two people edit restored a snapshot
taken before the other person's edit and silently reverted it.

Now `History.past`/`future` hold my own edits as `{ before, after }`. Undo applies the inverse ops
of my last edit (`diffDoc(after, before)`) to the current doc; redo the forward ops. When nothing
changed since, the stored doc comes back as is. Remote heads enter through `followHead`, never as a
step; an `amend` (slider drag) after a remote edit opens a new step instead of folding the remote
edit into mine. Last-writer-wins applies to undo too: if someone rewrote the same field after me,
my undo puts my old value back.
