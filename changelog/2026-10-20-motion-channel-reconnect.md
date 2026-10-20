# The frame channel reconnects and re-reads the head

`watchMotionNode` joined once. After a socket drop, an expired token or a sleeping Safari tab the channel stayed dead and remote edits showed only after a refresh. Not reproduced (WebKit and Chromium on production both applied remote `tools` and `move_node` live); this closes the one gap left.

It now runs on `createLink` like the canvas channel: backoff rejoin with a fresh `setAuth` on CHANNEL_ERROR, TIMED_OUT, CLOSED. Every rejoin, and every tab visible, focus or online, makes the editor re-read the head. The canvas channel already had this (`connectCanvas` resyncs on resubscribe).
