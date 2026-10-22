# One undo history for canvas and frames; instant restack

Before: ⌘Z asked the open frame's history first (`undoRoute` in `frame-multi.ts`), then the
canvas stack. Edits interleaved between canvas and a frame came back out of order, and a frame
not currently open was unreachable. Restack waited for the server and a full `refresh()`.

Now `FrameEditSession` tells its host on every new history step (`stepped`, not on coalesced
amends or undo/redo). GpuFlow forwards it as a `FrameStep` (`onFrameStep`), and the canvas page
pushes it on its single `undoStack` as `{ source: 'frame' }`. ⌘Z walks one chronological list;
a frame entry steps that frame's session back, whichever frame is open.

Restack reorders `nodes` locally (`stackedLocally`, draw order = array order, matching the
server's `order by z`) and only refreshes if the save fails.

Discarded: a merged timestamp log across two stacks — one stack is simpler and already exists.
