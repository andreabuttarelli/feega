# Motion tools run one at a time; Undo can't empty a video

Incident on node fd37d96f (09:21Z): the agent emitted five `edit_comp` calls in one step. The AI SDK
runs them concurrently; `edit_comp` swaps `session.doc` to the composition view, awaits its nested
calls, then merges back. Interleaved, each call read another's view as its root: the main timeline
ended up as one asteroid comp's contents and the scene landed inside another comp. `precompose`
itself was correct (synchronous body).

- `createMotionTools` returns every tool wrapped in one per-session queue (`oneAtATime`): calls run
  in emission order, each sees the doc the previous one left. `edit_comp`'s nested calls use the raw
  tools, so they don't deadlock on the queue. Read-only tools are queued too: fewer parts, and their
  cost is negligible next to the model.
- Undo/Redo are off while an agent turn runs or its draft is shown: the canvas shows the draft, so
  Undo changed the hidden history and the user pressed it blindly three times (v18–v20), the last
  two down to the blank doc the tab was seeded with. Undo with nothing to undo no longer saves.
- `adoptHead`: a head pulled into a tab that never saved (version 0) restarts the history, so the
  blank seed is not an undo step.

Not done here: the agent's end-of-turn save retries a conflict on the latest version, overwriting
a user's saves made during the turn.
