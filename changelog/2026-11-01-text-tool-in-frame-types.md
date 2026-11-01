# The text tool inside a selected frame starts typing

With a frame selected, the text tool draws through the frame's own overlay (`FrameTools` →
`DrawOverlay`), whose `ondrawn` only selected the new clip. Drawing straight onto the canvas set
`typeOnArrival`; this path never did, so a click made a "Text" box with no caret and the next keys
ran as shortcuts (C opened comments). Same on production. The e2e spec hid it with a double-click
fallback, now removed.

`drawnInside` now sets `typeOnArrival` for the frame and the new clip when the tool was Text.
First caret 130–230 ms after the click, then under 20 ms. Found in the release QA sweep.
