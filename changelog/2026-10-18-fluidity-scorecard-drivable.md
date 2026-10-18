# Fluidity scorecard: every step drivable, after-reload check, mounts split

- Steps that were UNDRIVEN now run on both renderers: nodes are brought into view by fit → marquee →
  zoom to selection (a click opens the editor and Escape drops the selection); rotate uses the
  inspector's `Rotate Z`; the group prop is a rotation through the group's handle; resize falls back
  to the `Width` field when the tile has no handle (DOM while editing); frames are tried until one
  has a layer with a fill, and that layer is reopened by name; generate nodes are found by type on
  GPU and by `.gen` on DOM, and the prompt/Generate are read from every element carrying the node id
  (GPU splits the shell from the DOM tile).
- The session starts away from the content, so inserted shapes never land under other nodes.
- Moves are monotonic: an alternating move pattern made a legitimate path look like a revert.
- New final step "after reload": reload, reopen the text, the frame layer and the generate node,
  and compare with the last values set.
- Player mounts split: "in view" (an untouched node already on screen got a player: gated) and
  "entering view" (lazy first mount of a node the camera brought in: reported only).
