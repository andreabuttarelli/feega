# Frame-doc actions show their result on the gesture

Moving an element out of a frame, pasting copied elements, placing a component, pasting a
free element into a frame, inserting a scene, combining scenes and turning layers into a frame
all used `landed(post(...))`: the result existed only once the server had written the frame
doc and the canvas had refetched it.

**Same plan on both sides.** The doc computations moved, unchanged, from
`src/lib/server/motion/move-element.ts`, `combine-scenes.ts` and `insert-scene.ts` into
`src/lib/motion/move-plan.ts` and `src/lib/motion/scenes.ts` (reorder commits). The server
reads, plans, writes; the canvas plans on the docs it already holds (`frameDocs.doc`, published
by GpuFlow) and shows the result.

**Id reconciliation by choosing ids on the client.** The canvas sends the new node id
(`node_id` / `frame_id`) and a list of clip ids (`ids`, consumed by `idsFrom` before falling
back to random ones); the server plans with them, so the stored docs equal the shown ones.
Route tests assert stored doc = client plan.

**Showing.** `src/lib/canvas/frame-moves.ts` turns a plan into what changes on screen: a new
tile (`made`), a tile that leaves (`gone`, an element emptied by a move), and docs to hold.
Docs go through `frameDocs.hold`: an existing frame's session amends its present
(`settleHeld`) and holds its saves until the op lands, so the frame changes on the same frame
(the #1598 patch path) and the server head, equal to it, is followed without a flash; a new
node is seeded like a drawn one (#1610). A refusal puts the previous doc back and rolls back
the touched tiles. Every action is one registry row built by `carriedRow`.

Layers to frame needs the stored pictures' sizes, so it shows a placeholder tile under the
final id until the frame lands. Optimistic sends now flush pending node data saves too
(insert scene used to flush the two nodes it reads).

| Action | Before | After (server delayed 2 s) |
|---|---|---|
| Move element out of a frame | 1379 ms | 25–28 ms |
| Paste copied elements | 786 ms | 35–38 ms |
| Combine scenes | 836 ms | 58 ms |
| Move free element into a frame | tile left at once, frame doc after refetch | frame doc on the same frame |
| Place component, paste free into frame, insert scene, layers to frame | waited | same path; unit and route tests only |
