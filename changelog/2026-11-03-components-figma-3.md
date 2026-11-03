# Components, round three: homing race, Layers drops, instance resize, panel speed

Follows `2026-11-03-components-figma-2.md`.

**Homing race.** Right after `⌥⌘K` a main could stay in its frame and be moved to the
Components page twice (duplicate sets), and an editor save right after homing could drop the
home the server wrote. `homeComponents` (`components-page.ts`) is now one idempotent op: each
set frame's node id is derived from source frame and main (`setNodeId`, sha1 → uuid), so a
repeat or concurrent homing reads the set that exists instead of creating one; a create that
loses the race reads the winner. The home write is version guarded and retried on a fresh
read (up to 4). The answer carries the written `head`. In the editor,
`FrameEditSession.rebaseOn` holds saves while the homing runs and takes the head as remote, so
the next save goes at the new version on top of the home. Replaced: the client re-committing
`homedAt` as its own undo step. MCP `home_components` returns `version` instead of the doc.
A deleted set whose id is taken falls back to a fresh id.

**Layers into a main.** `dropLayer` routes a drop `Into` a main row, or onto a row inside a
main (scene path `host·0·inner`), through `intoMain` (`layers.ts`): the layer is adopted into
the main's comp (`adopted` from `into-main.ts`) and placed in the view of the comp — at the end
of the root stack/frame, or above/below the row it was dropped on. Instances refuse (role).
`LayersPanel` accepts drops on rows inside a main (`landsInMain`). Deeper nesting is not
handled.

**Instance W/H.** `setLayerBox` on an instance scaled it (`placeBox` → `scaleAround`).
`resizeInstance` (`instance-resize.ts`) now resizes the main's single root through overrides
on the instance: x/y/width/height of the root, `layoutItem` fixed on the typed axis for an
auto layout root (which then reflows), and each direct child of a plain frame follows its
constraints (`followParent` in `constraints.ts`, same rules as a frame resize). A comp with
several roots still scales. Canvas handle drags are unchanged.

**Components panel.** ~20 s with ~180 sets: one `readHead` per frame. Heads whose revision the
node row knows (`docHeadRevision`) are read with `readHeads` in batches of 40; the rest fall
back to `readHead`. The panel mounts 24 tiles and adds a page when the sentinel scrolls in
(`firstTiles`). Previews were already lazy (IntersectionObserver) and kept in IndexedDB.
The list was already project scoped.

Every canvas open also called `/components` for Go to main (25 MB of docs parsed on
f077fd4e, during a production DB overload). `mainNav` now loads the list only the first time
a location is asked (`where`), and `showMain` refreshes it. On the server, each frame's mains
(`comps` with `component` only) are kept in memory per `org:node` at the head revision the row
knows; a listing with unchanged revisions reads no doc (5000 frames kept per instance).
