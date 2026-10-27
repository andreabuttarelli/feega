# Port dots stay visible on a selected node

**Before.** Selecting a Generate node handed it to the DOM. The DOM handles are invisible hit
targets (the dots were only ever drawn by the core), so the dots vanished while the names stayed.

**Now.** A node handed to the DOM gets `ChromeLayers.Ports`: the core overlay draws only its port
dots; ring, handles, names and label stay with the DOM. Dragging from a dot works as before.

**Discarded.** Styling the DOM handles as dots: a second drawing of the same dot, to keep in sync.
