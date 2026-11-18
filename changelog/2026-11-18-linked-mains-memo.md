# A frame links to its mains once per state of its homes

`linkedMains(doc, frameId, homes)` built a new doc on every call, even for the same doc against the
same home docs. Every `/motion/sources` ask relinked each frame, so the `WeakMap` memos keyed on the
doc downstream (`idsIn` in `doc-assets.ts`, the doc JSON memo) never hit for a frame that holds
instances of a main: on the 36-page stress canvas the asset-id scan alone cost the local server
~1.1 s of a cold open.

`linkedMains` now keeps, per input doc, the frame id, the home docs it read and the result, and
hands the same result back while those home docs are the same objects. Parsed heads are already
cached and shared (`readHeads`), so a home that did not change is the same object. A changed home
relinks. Applies to hosted and local.
