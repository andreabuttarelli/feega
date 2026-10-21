# Core canvas: only changed items cross into the WebAssembly core

A frame edit makes a new revision, so a new group key. Before, the new group was serialised whole
(`JSON.stringify`), parsed by the core and its encoded scene rebuilt from item 0.

Now `spliceOf` (`group-diff.ts`) compares the new list with the group of the same node the core already
holds, item by item (hash of each item, cached per list): common head, common tail, and the items in
between. `CoreFrames.putPart` sends that as `patch_group(from, to, splice)`; the core builds the new group
from the old one and reuses every encoded run that ends before the first changed item
(`Encoded::reusing`, runs are `Arc` now). Initial load, a changed frame size/background/faces, a middle
bigger than one part, or a refusal from the core all fall back to the old `put_group` path.

Discarded: keying items by `clip` (several items share one), and reusing runs after the edit (run
boundaries shift when an item is added or removed).

Cost, 5000 items, one edited in the middle (`cargo run --release --example patch_cost`): put + encode
15.2 ms, patch + encode 2.5 ms. JS side is unchanged (hashing every item costs about what stringifying the
list did).
