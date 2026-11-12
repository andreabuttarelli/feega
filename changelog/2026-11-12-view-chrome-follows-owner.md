# Canvas: breakpoint-view chrome moves with its node's selected part

The core overlay is split in a fixed part (sent once) and a selected part (resent while the
selection moves). A node's breakpoint views (tablet, phone) carry their own id, so their
chrome went to the fixed part even when their node was selected. Dragging a landing page with
views changed the fixed part every frame: the whole overlay was serialised and reparsed by the
engine per move, about 60% of main-thread JS in the frame-drag profile on the landings
fixture.

`ChromeOnCanvas.owner` names the node a view belongs to; the split uses it, so a drag only
resends the dragged node's chrome.
