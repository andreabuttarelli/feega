# Opening a frame on a phone: no black node, neighbours stay

- The node keeps its poster/live picture until the editor player has drawn (`inlineStage` paint: pending → shown after `ready` + 2 frames → swapped 300 ms later; `nodeLayers` table). The editor stage stays at opacity 0 until shown. Before: the node body emptied on open and showed the stage's black background.
- Phone: a tap only selects (drag works); "Open editor" opens it (`OPENING` table by viewport). The session is fetched on selection, so it is ready when the button is pressed.
- While edited the node is only the picture: no bar (`frameNodeSize(..., NodeMode.Edit)`); the stored height is untouched.
- Phone neighbours stay at 0.85 opacity; only labels and ports hide (`NEIGHBOUR_WHILE_EDITING`). Before: every other node faded to 0.
- Chat and inspector contents mount after the first frame (4 s fallback).
- `frame_open_timing` PostHog event (consent-gated): ms from tap to session, chrome, player ready, first frame, or `closed`; plus engine, viewport, cores. Emulation measured ~1 s where an iPhone takes 4–5 s; this reads the real device.

Not done: optimistic chrome before `/session` (the shell needs the full session) and reusing the node's player (moving an iframe reloads it).
