# Frame tiles lose their playback bar

Idle canvas nodes are GPU snapshots now, so the play/stop/loop/volume bar and the scrub/timecode on frame tiles were controls nobody could use. They are gone from the tile (DOM and GPU); playback lives in the inline and full frame editor. "Open editor" stays. `MOTION_NODE_BAR_H` is 0: new frames are exactly their picture; frames saved before keep their stored height, so their picture sits in 44 px of extra room until resized.
